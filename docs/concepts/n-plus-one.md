# N+1 Problem (e eager loading como prevenção)

## Definição

O **problema N+1** é um anti-padrão de performance de ORM: uma query inicial retorna **N**
linhas, e depois **uma query adicional é emitida por linha** — `1 + N` round-trips ao banco onde
uma única query maior bastaria.

```js
const posts = await postRepo.findMany(); // 1 query → N posts
for (const post of posts) {
  post.author = await userRepo.findById(post.authorId); // N queries a mais
}
```

O total é `N + 1` queries. A correção é buscar todos os autores em **uma** query em lote e
costurá-los em memória:

```js
const posts = await postRepo.findMany(); // 1
const authors = await userRepo.findMany({
  where: (c) => [c.id!.in(posts.map((p) => p.authorId))],
}); // 1
const byId = new Map(authors.map((a) => [a.id, a]));
for (const post of posts) post.author = byId.get(post.authorId);
```

`2` queries, constante em N.

## Por que é tão comum com ORMs

ORMs fazem uma leitura de linha única parecer uma chamada de método barata (`findById`,
`findOne`). Iterar uma coleção chamando esse método por elemento é o idioma orientado a objetos
*natural* — então o anti-padrão é **fácil de escrever e invisível no nível do fonte**. O custo só
aparece no log de queries ou sob carga. O
[paper REFORMULATOR](../research/reformulator-n-plus-one.md) o encontrou em 1,1% de 37 mil
repositórios Sequelize (1.872 instâncias) — raro por repo, mas o custo por instância escala
brutalmente: até **38,58×** mais lento em bancos grandes.

## Duas formas de atacar

1. **Detectar e refatorar (retrofit).** Análise estática encontra o loop, uma regra de reescrita
   o transforma em lote. É a abordagem do REFORMULATOR via taint analysis (abaixo).
2. **Eager loading (prevenção).** O ORM oferece uma forma de primeira classe de pedir os dados
   relacionados antecipadamente (`relations: ['author']`) e os resolve numa query em lote, de
   modo que o usuário nunca escreve o loop.

As duas são a mesma transformação — uma query em lote + join em memória — aplicada em pontas
opostas do ciclo de vida.

## Exposição do OOR

> **O OOR pode produzir N+1 hoje, sem alternativa embutida.** `findMany` / `findOne` do
> [Repository](../components/repository.md) **não seguem relações** (sem JOIN, sem segunda query).
> Um usuário que itera os resultados de `findMany()` chamando `findById()` por linha reproduz o
> anti-padrão exatamente, e o OOR não oferece opção de eager loading para afastá-lo disso. Fechar
> isso faz parte da decisão de estratégia de carregamento em
> [questions/support-one-to-many.md](../questions/support-one-to-many.md).

O [Lazy Query Builder](lazy-query-builder.md) compõe cláusulas, mas nunca *dispara
automaticamente* uma query por linha, então o OOR não gera N+1 *implicitamente* do jeito que um
ORM com propriedades de relação lazy faz — a exposição aqui são **loops escritos pelo usuário**,
não lazy loads escondidos pelo framework. É uma vantagem de design significativa, que vale
preservar quando o eager loading for adicionado. Ver o argumento completo em
[orm-patterns.md](orm-patterns.md#o-argumento-da-analisabilidade-explicitness-vs-o-n1-problem).

## Eager loading — as três formas de SQL

Quando um ORM carrega `Parent` + seus `Children` avidamente, precisa escolher uma estratégia de
SQL. O benchmark [JCSI 2025](../research/orm-frameworks-node-jcsi-2025.md) observou as três ao
vivo:

| Estratégia | Forma | Custo |
| --- | --- | --- |
| **LEFT JOIN único** | um statement; colunas do pai duplicam por linha filha | um round-trip, mas inflação do row-set + passagem de dedup no código da aplicação (escolha do Sequelize) |
| **Subquery com dedup** | um statement, subquery aninhada para evitar duplicação | um round-trip, mas a geração + execução de SQL mais pesada (escolha do TypeORM — a mais lenta no endpoint de leitura aninhada) |
| **Duas queries + costura em memória** | IDs dos pais primeiro, depois `WHERE child.fk IN (...)`, join em memória | dois round-trips, mapeamento mais limpo, melhor com linhas de pai largas (escolha do Prisma) |

> **A transformação do REFORMULATOR = a estratégia de duas queries.** As regras de reescrita do
> paper transformam uma query por linha em loop exatamente na forma **duas queries +
> `.find`/`.filter` em memória**. Ao longo de 44 refatorações, ela preservou comportamento e
> melhorou performance (até 38,58× em escala). É evidência empírica a favor da estratégia de
> segunda query em vez de LEFT-JOIN-e-dedup quando um ORM desenha eager loading do zero.

### Onde isso aterrissa no OOR

O OOR **não tem eager loading hoje**. A escolha de estratégia é o Eixo 3 (lazy vs. eager vs.
opt-in) e o Eixo 4 (JOIN vs. duas queries) de
[questions/support-one-to-many.md](../questions/support-one-to-many.md). As duas fontes externas
apontam na mesma direção:

- O JCSI mostra a subquery do TypeORM como a estratégia de leitura aninhada *mais lenta* das três.
- O REFORMULATOR valida a forma duas-queries + join-em-memória como preservadora de comportamento
  e rápida.

Juntas, elas fazem da **opção opt-in `relations: [...]` resolvida via uma segunda query em lote**
o ponto de partida com melhor evidência para o OOR — embora nenhuma decisão esteja registrada
ainda.

## Taint analysis — como o REFORMULATOR detecta N+1

**Taint analysis** é uma análise estática de fluxo de dados que rastreia como valores originados
em **sources** designados se propagam ("taint" se espalha) até **sinks** designados através de
atribuições, chamadas de função, acessos a campos e operações de coleção. Classicamente usada em
segurança (ex.: input não confiável alcança uma string SQL?), mas a técnica é geral: escolha o
que conta como source, o que conta como sink, e a análise reporta todo fluxo entre eles.

Para detectar o N+1, o REFORMULATOR reconfigura a taint analysis para ORMs:

- **Sources** = os *resultados* de chamadas de API de ORM (`await Model.findAll(...)` retorna
  dados "taints").
- **Sinks** = os *argumentos* de chamadas de API de ORM (`Model.findOne({ where: ... })`).

Um fluxo de taint de um source até um sink que **cruza a fronteira de um loop** é um N+1
candidato: dados buscados uma vez estão sendo alimentados, linha a linha, numa query emitida
repetidamente. A análise também registra os **nomes das propriedades** nas duas pontas do fluxo
(ex.: `subscribeTo ← channel.id`), que as regras de reescrita precisam para saber qual campo
batelar e casar. Implementado sobre o framework de taint-tracking do **CodeQL**.

### Ressalva de soundness

Análise estática de JavaScript é **unsound** — redefinição dinâmica de propriedades, construtos
tipo `eval` e assincronia baseada em promises derrotam o rastreamento preciso. O REFORMULATOR,
portanto, apresenta seus resultados como **sugestões a serem verificadas** (rode os testes), não
transformações garantidamente corretas. O paper enquadra isso como seguir trabalhos recentes de
refatoração de JS, em que soundness é trocada por praticidade.

> **Relevância para o OOR.** Não é uma técnica que o OOR usa. Importa aqui apenas como o
> *mecanismo* pelo qual o paper encontra N+1 — contexto útil se o TCC um dia discutir tooling
> capaz de analisar aplicações baseadas em OOR. A aposta do próprio OOR (decorators Stage-3 +
> `no-any` estrito) é manter o comportamento estaticamente *conhecível no nível de tipos*, em vez
> de recuperado por taint tracking de programa inteiro.

## Conexões

- [research/reformulator-n-plus-one.md](../research/reformulator-n-plus-one.md) — o paper-fonte.
- [research/orm-frameworks-node-jcsi-2025.md](../research/orm-frameworks-node-jcsi-2025.md) — o
  benchmark que mede as três estratégias de eager loading.
- [questions/support-one-to-many.md](../questions/support-one-to-many.md) — onde a estratégia de
  carregamento do OOR será decidida.
- [orm-patterns.md](orm-patterns.md) — por que a explicitness do Data Mapper mantém o N+1 visível
  e analisável.
