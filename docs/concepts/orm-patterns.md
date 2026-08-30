# Active Record vs. Data Mapper (padrões de persistência)

Dois padrões clássicos de persistência de Martin Fowler (*Patterns of Enterprise Application
Architecture*, 2002) emolduram a principal escolha de design de um ORM. O OOR escolheu Data
Mapper (na especialização [Repository Pattern](repository-pattern.md)) — ver
[ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md).

## Active Record

Padrão em que **o objeto do modelo é a linha do banco**. A mesma classe carrega os valores dos
campos *e* os verbos de persistência:

```ts
const user = await User.findByPk(1);
user.name = 'renamed';
await user.save();
await user.destroy();
```

Propriedade definidora: uma única classe é responsável por duas preocupações não relacionadas —
**dados** (a forma da linha) e **persistência** (falar com o banco). Instâncias são stateful —
há diferença entre uma instância "nova" e uma "carregada", e a classe a rastreia internamente.

| Pró | Contra |
| --- | --- |
| Superfície de API compacta — uma classe por tabela | A classe do modelo não pode ser um DTO puro; testar exige banco ou mock |
| Mapeamento direto lê naturalmente para CRUD simples | Difícil escalar para operações multi-tabela sem vazar SQL |
| Menos indireções em runtime → baixo overhead por chamada | O padrão resiste a [DI](di-container.md) e testes de unidade |
| O SQL compacto costuma ser o mais eficiente em ops de linha única | Padrões de concorrência / multi-linha degradam rápido |

Os resultados do Sequelize no [paper JCSI 2025](../research/orm-frameworks-node-jcsi-2025.md) são
a visão empírica mais clara desses trade-offs no ecossistema Node: melhor performance de registro
único, pior performance sob carga paralela.

Implementações notáveis: **Sequelize** (o AR canônico em Node), **TypeORM** (suporta ambos; o
estilo que estende `BaseEntity` é o modo AR), ActiveRecord do Ruby on Rails (o xará), Eloquent do
Laravel (PHP).

## Data Mapper

Padrão em que **o objeto do modelo e a camada de persistência são desacoplados**. O modelo guarda
apenas a forma dos dados; um objeto "mapper" separado (frequentemente chamado Repository) lê e
escreve instâncias no banco:

```ts
const user = await userRepository.findById(1);
user.name = 'renamed';
await userRepository.update(user);
await userRepository.delete(user);
```

A classe do modelo não tem consciência de persistência — pode ser serializada, clonada,
transmitida pela rede ou construída num teste com `new User()` sem tocar num banco.

Propriedade definidora: **separação de preocupações no nível de tipos.** Um `User` é um valor. Um
`Repository<User>` sabe ler e escrever `User`s. Os dois nunca colapsam na mesma classe.

| Pró | Contra |
| --- | --- |
| Modelos são dados puros — fáceis de testar, transmitir, serializar | Uma camada a mais de indireção por chamada |
| Verbos de persistência têm escopo por entidade, não por instância | Mais superfície de API para aprender (métodos do Repository) |
| Combina naturalmente com [DI](di-container.md) | Overhead fixo por chamada — cargas sequenciais pagam sempre |
| Escala para concorrência de leitura sem contenção de estado de instância | Autores são tentados a adicionar helpers no modelo mesmo assim |

Os resultados do Prisma no paper JCSI 2025 ilustram o trade-off: melhor performance sob carga
paralela (porque não há estado de instância para coordenar), mas pior performance sequencial sem
cache (toda chamada paga a indireção).

A relação entre os padrões:

```
Data Mapper (Fowler) ⊃ Repository Pattern (Evans, DDD 2003) ⊃ Repository<T> do OOR
```

## Por que o OOR rejeita Active Record

A árvore de decisão:

1. **Modelos continuam carregadores puros de dados.** Uma instância de `User` é um valor, não um
   handle de persistência. Sem método `.save()`.
2. **Verbos de persistência vivem num `Repository<T>` separado.** Isso mantém o sistema de tipos
   honesto: um `User` não sabe se escrever.
3. **Composição via [Lazy Query Builder](lazy-query-builder.md), não método-na-instância.**
   Leituras encadeadas não brigam com o padrão.

A compacidade do Active Record é uma vitória real nos casos simples, mas inviabiliza a superfície
de Repository por entidade que o OOR queria.

### O modo de falha da associação lazy

O custo mais insidioso do Active Record não está na sua tabela de trade-offs — é a **associação
lazy**: ler uma propriedade de relação (`user.posts`) pode disparar um `SELECT` escondido, de
modo que iterar uma coleção produz silenciosamente o
[N+1 Problem](n-plus-one.md) *sem nenhum call site para revisar ou grep*. O
[estudo REFORMULATOR](../research/reformulator-n-plus-one.md) documenta quão prevalente e caro é
o N+1 (lentidões de até 38,58×) e cita especificamente essa variante de "lazy loading
ineficiente". A escolha de Data Mapper do OOR fecha essa superfície: toda query é uma chamada
explícita `repo.findX()`, e o Lazy Query Builder nunca dispara uma query por linha
automaticamente.

> **Contraste honesto.** O Sequelize é um ORM AR que usa chamadas *explícitas*
> (`findAll`/`findOne`), e os exemplos do REFORMULATOR são loops de chamadas explícitas — logo AR
> não é uniformemente pior. O contraste decisivo é com o estilo de *lazy-load implícito* (Rails
> ActiveRecord, Eloquent), que a superfície Data Mapper do OOR recusa por construção.

## O argumento da analisabilidade: explicitness vs. o N+1 Problem

> A propriedade definidora do Data Mapper — *todo acesso ao banco é uma chamada de método
> explícita e nomeada num mapper separado* — é também uma propriedade **defensiva** contra o bug
> de performance de ORM mais prevalente, o N+1. O paper REFORMULATOR (ASE '22) é a evidência, e
> ela se dá em três passos.

**1. N+1 é prevalente e caro, não um corner case.** O REFORMULATOR varreu 100 mil repositórios
JavaScript e encontrou o anti-padrão em centenas deles (1.872 instâncias), com lentidões medidas
de até **38,58×** em tamanhos realistas de banco e regressões de tempo de carregamento de
front-end de até 90%. Qualquer decisão de padrão que um ORM tome deve ser pesada contra como ela
interage com esse bug.

**2. Data Mapper mantém o bug visível.** Num mundo Data Mapper / Repository, um N+1 sempre
emerge como um loop *literal* contendo uma chamada nomeada —
`for (const p of posts) await userRepo.findById(p.authorId)`. É auditável em code review e
grepável no fonte. Contraste com o pior modo de falha do Active Record: uma **associação lazy**
dispara uma query escondida atrás de uma leitura de propriedade simples (`user.posts` → `SELECT`
silencioso), de modo que o N+1 *não tem call site algum*. O sabor do OOR recusa essa superfície
inteiramente — não há `.save()`, não há propriedade de relação lazy, e o Lazy Query Builder
acumula cláusulas mas **nunca dispara uma query por linha automaticamente**. O framework portanto
nunca gera N+1 *implicitamente*; o único jeito de produzi-lo é um loop que o desenvolvedor
consegue ver.

**3. Chamadas explícitas são a pré-condição para tooling.** O REFORMULATOR detecta N+1 com
[taint analysis](n-plus-one.md) estática que trata **resultados de chamadas de API de ORM como
sources e argumentos de chamadas de API de ORM como sinks**. Essa técnica só funciona porque as
queries são chamadas explícitas e nomeadas, para as quais um analisador estático consegue
apontar. Um ORM que esconde queries atrás de mágica de propriedades não dá ao analisador nada
para rastrear. A superfície explícita do Data Mapper é, portanto, o que torna código estilo-OOR
*passível dessa classe exata de detecção e refatoração automatizadas* — uma propriedade valiosa
para uma biblioteca que mira corretude.

> **Os limites honestos da alegação.** Data Mapper **não** *elimina* N+1 — um desenvolvedor ainda
> pode escrever o loop. A correção de fato é [eager loading](n-plus-one.md) (buscar as linhas
> relacionadas numa query só), que o OOR ainda não construiu; a estratégia está aberta em
> [questions/support-one-to-many.md](../questions/support-one-to-many.md). E o contraste acima é
> especificamente com a variante de *lazy-load implícito* do Active Record. A alegação precisa e
> defensável é mais estreita — e se sustenta: a explicitness do Data Mapper **mantém o bug
> visível e estaticamente analisável, e recusa o footgun do lazy-load escondido**, que é a forma
> mais insidiosa de o N+1 entrar num codebase.

## O sabor do OOR

O Repository do OOR é mais estreito que o do Prisma ou o do TypeORM — ver
[repository-pattern.md](repository-pattern.md). Métodos-chave:

- `repo.findById(pk)` / `repo.findOne(opts)` / `repo.findMany(opts)`
- `repo.create(entity)` / `repo.update(entity)` / `repo.delete(entity)`

Nenhum método no próprio `User`. Nenhum `BaseEntity` para estender. Nenhum `instance.save()`.

## Conexões

- [ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md) — a decisão que fixa o
  padrão.
- [repository-pattern.md](repository-pattern.md) — a especialização DDD do Data Mapper que o OOR
  implementa.
- [research/orm-frameworks-node-jcsi-2025.md](../research/orm-frameworks-node-jcsi-2025.md) — o
  perfil empírico de performance de AR e DM em Node.
- [n-plus-one.md](n-plus-one.md) — o anti-padrão que ancora o argumento da analisabilidade.
