# REFORMULATOR: Automated Refactoring of the N+1 Problem in Database-Backed Applications (ASE '22)

## Citação

A. Turcotte, M. W. Aldrich, F. Tip. *REFORMULATOR: Automated Refactoring of the N+1 Problem in
Database-Backed Applications.* Em **ASE '22: 37th IEEE/ACM International Conference on Automated
Software Engineering**, 10–14 out 2022, Rochester, MI, USA. ACM.
<https://doi.org/10.1145/3551349.3556911>

Autores: Alexi Turcotte (Northeastern), Mark W. Aldrich (Tufts), Frank Tip (Northeastern).
Apoiado por NSERC e NSF grant CCF-1907727; agradece Oracle Labs.

Fonte: PDF em `.raw/n+1 refactor.pdf` (no vault Obsidian).

## O que o paper é

Uma ferramenta, **REFORMULATOR**, que detecta e refatora automaticamente instâncias do
[N+1 Problem](../concepts/n-plus-one.md) em aplicações JavaScript usando o ORM Sequelize. Usa
[taint analysis](../concepts/n-plus-one.md) estática (construída sobre CodeQL) para encontrar
fluxo de dados entre duas chamadas de API de ORM — onde o *resultado* de uma chamada flui para o
*argumento* de uma segunda chamada dentro de um loop — e então aplica **regras de reescrita
declarativas** que batelam a query do loop numa query única mais um lookup em memória.

Como análise estática sound de JavaScript é inviável (redefinição dinâmica de propriedades,
promises, construtos tipo eval), o REFORMULATOR apresenta suas refatorações como **sugestões a
serem verificadas por um programador** (ex.: rodando testes), não transformações garantidamente
seguras.

## O anti-padrão N+1 (forma motivadora)

A forma canônica do paper, tirada do `recommendChannels` do `youtubeclone`:

```js
// 1 query: busca até 10 canais
const channels = await User.findAll({ limit: 10, where: { id: [Op.not]: req.user.id } });
// N queries: um Subscription.findOne POR canal
channels.forEach(async (channel) => {
  const isSubscribed = await Subscription.findOne({
    where: { subscriber: req.user.id, subscribeTo: channel.id },
  });
  channel.setDataValue("isSubscribed", !!isSubscribed);
});
```

`1 + N` round-trips. A correção emite *uma* query extra antes do loop e resolve cada lookup em
memória:

```js
const subscriptions = await Subscription.findAll({
  where: { subscriber: req.user.id, subscribeTo: channels.map((chan) => chan.id) },
});
channels.forEach((channel) => {
  const isSubscribed = subscriptions.find((data) => data.subscribeTo === channel.id);
  channel.setDataValue("isSubscribed", !!isSubscribed);
});
```

`2` round-trips, constante em `N`, comportamentalmente equivalente, e escala com o crescimento
do banco.

## A abordagem: dois componentes

### 1. Análise de fluxo de dados (taint)

A pergunta: *existe fluxo de dados entre duas chamadas de API de ORM?* Chamadas de API de ORM são
**sources** (seus resultados são tainted); argumentos de chamadas de API de ORM são **sinks**.
Um fluxo source→sink que **cruza a fronteira de um loop** é um N+1 candidato. Construída sobre o
framework de taint do CodeQL. A análise também registra os **nomes das propriedades** nas duas
pontas do fluxo (ex.: `subscribeTo ← channel.id`) via um helper
`getAllPropertiesWithDataFlow(O, m)`, porque a reescrita precisa saber *em qual* campo casar.

### 2. Regras declarativas de reescrita

Quatro regras, uma por forma da chamada interna (no loop). Em toda regra a chamada de ORM do loop
vira um único `findAll` pré-loop, e o acesso dentro do loop vira um `.find` / `.filter` /
`.count` sobre o array buscado.

| Regra | Chamada interna (antes) | Depois |
| --- | --- | --- |
| **findAll → findOne** | `M2.findOne(O2)` no loop | `m2s = await M2.findAll(O2′)` uma vez; `m2s.find(m2 => BE)` no loop |
| **findAll → count** | `M2.count(O2)` no loop | `findAll` pré-loop com **GROUP BY** + agregação de count; `m2s.find(m2 => BE).count` no loop |
| **findAll → findByPk** | `M2.findByPk(x.f)` no loop | `findAll({ where: { pk: m1s.map(m1 => m1.f) } })`; `m2s.find(m2 => x.f == m2.pk)` |
| **findAll → findAll** | `M2.findAll(O2)` no loop | `findAll` pré-loop; `m2s.filter(m2 => BE)` (um filter, não um find) |

Funções auxiliares que constroem os objetos reescritos:

- `getAllPropertiesWithDataFlow(O, m)` — os pares propriedade/valor em `O` que foram alvos de
  fluxo de dados a partir de `m`.
- `updatePropReferences(props, O, ms, M)` — reescreve essas propriedades para serem **maps sobre
  o array buscado** (`p: ms.map(m => m.f)`), transformando N lookups escalares num batch estilo
  `IN (...)`.
- `createArrayLookup(props)` — constrói a expressão booleana `BE` (`m1.p === v & ...`) usada pelo
  `.find` / `.filter` em memória para escolher a linha certa.
- `addAggregationAndCount(props, O, ms, M)` — a variante de count: adiciona um `GROUP BY` sobre
  as chaves de join e uma agregação de count para que a query única retorne contagens por grupo.

> **As regras são ORM-agnósticas em espírito.** O paper nota que os nomes de método do Sequelize
> (`findAll`/`findOne`/`findByPk`/`count`) são "para legibilidade" — as regras capturam questões
> mais amplas de ORM: *encontrar-e-depois-encontrar*, *encontrar-e-depois-contar*,
> *encontrar-e-depois-encontrar-por-pk*. Qualquer ORM com uma leitura de coleção + uma leitura
> por elemento tem a mesma exposição. **O OOR incluso.**

## Implementação

- Fluxo de dados estático como uma **configuração de taint** do CodeQL (resultados de ORM =
  sources, argumentos de chamadas de ORM = sinks).
- Reescritas implementadas com **BabelJS** (parser + gerador de código).
- Distribuída como artefato Docker (Zenodo 6959485) que reexecuta a avaliação inteira.

## Avaliação (5 questões de pesquisa)

- **RQ1 (detecção):** varreu 100 mil repositórios GitHub que declaram Sequelize; 37.074 compilaram
  limpo; **427 (1,1%)** tinham ≥1 anti-padrão N+1; **1.872** instâncias no total. Conservador por
  design (maximizar sucesso de transformação).
- **RQ2 (comportamento):** em 8 projetos escolhidos a dedo — **44 instâncias de N+1 em 27
  handlers HTTP** — toda refatoração sugerida foi aplicada e as respostas HTTP comparadas
  antes/depois. **Sem mudanças de comportamento, sem crashes.** Uso das regras:
  findAll→findAll ×10, findAll→findByPk ×9, findAll→findOne ×5, findAll→count ×20.
- **RQ3 (performance):** contagem de queries constante pós-refatoração; **toda** refatoração
  melhorou performance. Melhor ganho individual **7,67×** (`eventbright`); mediana ~2,81× entre os
  handlers do `youtubeclone`. Ganhos **crescem com o tamanho do banco** — até **38,58×** na
  escala de 1.000 linhas (`youtubeclone`, ver tabela abaixo).
- **RQ4 (carregamento de página):** melhorias de tempo de carregamento de front-end de até
  **~90%** em banco grande (medido manualmente com Chrome DevTools, porque traces de profiling
  automatizados estavam ruidosos demais).
- **RQ5 (tempo de execução):** ~58,14s de média ponta a ponta num install limpo (≈12s install +
  ≈27s de build do banco CodeQL + ≈31s de query de detecção); a transformação de código em si é
  **<1s** em todos os casos.

### Aplicações-sujeito (Tabela 1)

| Projeto | LOC | Arquivos | # N+1 | # Handlers |
| --- | --- | --- | --- | --- |
| youtubeclone | 10.551 | 117 | 12 | 7 |
| eventbright | 12.085 | 122 | 15 | 7 |
| property-manage | 13.959 | 154 | 2 | 2 |
| Math_Fluency_App | 12.473 | 114 | 6 | 3 |
| employee-tracker | 10.336 | 112 | 3 | 2 |
| Graceshopper-Elektra | 12.342 | 141 | 1 | 1 |
| wall | 11.152 | 134 | 2 | 2 |
| NetSteam | 12.485 | 136 | 4 | 4 |
| **Soma** | | | **44** | **27** |

### Tabela de escalabilidade (Tabela 3, ms, antes → depois, fator)

| Projeto | DB=10 | DB=100 | DB=1000 |
| --- | --- | --- | --- |
| youtubeclone | 360→118 (3,05×) | 1.937→153 (12,67×) | 18.172→471 (**38,58×**) |
| eventbright | 111→32 (3,49×) | 797→50 (16,10×) | 7.001→215 (32,62×) |
| property-manage | 57→34 (1,69×) | 246→111 (2,22×) | 1.334→786 (1,70×) |
| employee-tracker | 57→34 (1,67×) | 375→154 (2,43×) | 2.496→1.010 (2,47×) |
| NetSteam | 77→39 (1,98×) | 338→42 (8,11×) | 2.129→108 (19,71×) |

> **Quando o speedup é pequeno:** `property-manage` / `employee-tracker` ganham menos — a maior
> parte do tempo de requisição deles é gasta *processando* os dados já buscados, não esperando
> round-trips. O paper é honesto que remover N+1 só ajuda quando round-trips dominam. Ainda assim
> benéfico em escala: conforme apps migram de bancos locais para bancos gerenciados remotos com
> tetos de conexão, menos requisições importa diretamente.

## Por que importa para o OOR

A superfície de leitura do OOR — `findMany`, `findOne`, `findById`
([components/repository.md](../components/repository.md)) — é exatamente o trio do Sequelize que
o paper reescreve (`findAll`/`findOne`/`findByPk`). Dois ângulos distintos:

1. **O OOR pode emitir N+1 *hoje*, nas relações `@ToOne` existentes.** `findMany`/`findOne` não
   seguem relações. Um usuário que itera resultados de `findMany()` e chama `findById()` por
   linha reproduz o anti-padrão exato do paper, e o OOR não tem API de eager loading para oferecer
   como alternativa. Ver [concepts/n-plus-one.md](../concepts/n-plus-one.md) § Exposição do OOR.
2. **A correção certa é uma API de eager loading, que é precisamente o Eixo 3 / Eixo 4 de
   [questions/support-one-to-many.md](../questions/support-one-to-many.md).** A transformação
   `findAll→findOne` do REFORMULATOR é a versão *manual* do que uma opção `relations: ["posts"]`
   faria automaticamente: uma query batelada `WHERE fk IN (...)` + uma costura em memória. O
   paper é evidência empírica a favor da estratégia **duas-queries-mais-join-em-memória** (Eixo
   4, segunda opção) sobre a estratégia LEFT JOIN + dedup — é a forma que o REFORMULATOR
   escolheu, e ela preservou comportamento em 44 casos.

> **Prevenção vs. retrofit.** O REFORMULATOR *retroativa* batching sobre código de aplicação
> ingênuo depois do fato. Uma boa API de eager loading de ORM *previne* que o código ingênuo seja
> escrito em primeiro lugar. Mesma transformação, pontas opostas do ciclo de vida. Para o TCC,
> este paper é a citação que justifica por que uma opção de eager loading não é feature de luxo —
> ela fecha um bug de performance documentado, mensurável e prevalente.

## Ameaças à validade (do próprio paper)

- Análise estática de JS é **unsound** — transformações são sugestões, precisam ser testadas.
  (Espelha a própria aposta do OOR em decorators Stage-3 + tipos estritos para manter o
  comportamento estaticamente conhecível.)
- A seleção de projetos pode não ser representativa (mitigada por amostragem aleatória de
  repositórios que declaram Sequelize).

## Trabalhos relacionados contra os quais o paper se situa

PowerStation (Yang et al.) detecta outras ineficiências de ORM mas **não** N+1; SLOTH (Cheung et
al.) lazifica/batela via compilador mas não refatora permanentemente; Chen et al. catalogam
anti-padrões de ORM em Rails/Laravel/JPA incluindo "lazy loading ineficiente". A alegação de
novidade do paper: ***refatoração* automatizada (não só detecção) de N+1.**

## Páginas relacionadas

- [concepts/n-plus-one.md](../concepts/n-plus-one.md) — o anti-padrão, eager loading e taint
  analysis.
- [concepts/orm-patterns.md](../concepts/orm-patterns.md) — o argumento da analisabilidade
  (explicitness do Data Mapper vs. N+1).
- [questions/support-one-to-many.md](../questions/support-one-to-many.md) — onde a estratégia de
  carregamento do OOR será decidida.
- [orm-frameworks-node-jcsi-2025.md](orm-frameworks-node-jcsi-2025.md) — a fonte externa irmã
  (benchmark comparativo).
