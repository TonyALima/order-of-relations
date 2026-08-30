# O OOR deveria implementar suporte a relações `@OneToMany`?

> Status: **aberta** (sem decorator; o enum de metadados já reserva o slot) · Impacto: **alto** ·
> Esforço: **G**

## Questão

O OOR entrega exatamente um decorator de relação: `@ToOne`. O enum `RelationType` já declara os
dois membros — `TO_ONE = 'to-one'` e `TO_MANY = 'to-many'`
(`src/core/metadata/metadata.ts:15-18`) — mas `TO_MANY` nunca é construído em lugar nenhum do
codebase. Deveríamos entregar um decorator `@OneToMany` de verdade, mais o `@ManyToOne` pareado
(já que num one-to-many a FK vive no lado *many*, não no lado *one*)?

## Por que importa

- **Sem to-many, o OOR não modela a forma mais comum de schemas reais.** "User tem muitos Posts",
  "Order tem muitos LineItems", "Author tem muitos Books". Hoje o único jeito de percorrer essas
  relações é expor o `@ToOne` inverso e consultar manualmente com um `WHERE author_id = ...`.
  Funciona para o autor do codebase, não para a audiência de pacote npm que o projeto mira.
- **A camada de metadados já o antecipa pela metade.** `RelationType.TO_MANY` existe;
  `RelationMetadata` tem um discriminador `relationType`. Implementar `@OneToMany` é em parte
  *terminar* o trabalho que o modelo de dados já implica — e em parte corrigir os dois caminhos
  de código que hoje *assumem* que toda relação tem colunas FK na linha local.
- **Fundação para `@ManyToMany`.** O padrão clássico de ORM decompõe many-to-many em duas metades
  `@OneToMany` sobre uma tabela de junção. Qualquer resolução que esta questão tomar vai
  restringir o espaço de design de [support-many-to-many](support-many-to-many.md) — devem ser
  consideradas juntas, não isoladas.
- **Já é estrutural na documentação.** [examples.md](../examples.md) registra
  `examples/relations/` como lacuna. Sem `@OneToMany`, esse exemplo só conseguiria cobrir a
  metade to-one de "relações" — uma lacuna significativa para um ORM literalmente chamado *Order
  of Relations*.

## Comportamento atual (para a questão não decair)

- **Só existe `@ToOne`.** `src/decorators/relation/relation.ts` exporta exatamente
  `OneToOneOptions` e `ToOne` — nada de `OneToMany`, `ManyToOne` ou `ManyToMany`.
- **`RelationMetadata.relationType` é hard-coded como `TO_ONE`.** Nada mais em `src/` constrói um
  valor `RelationMetadata`, então `TO_MANY` é terra morta de enum.
- **`MetadataStorage.resolveRelations()` gera colunas FK automaticamente para *toda* relação**
  (`metadata.ts:84-104`). Assume que a FK vive na tabela local: puxa as colunas primárias do
  alvo, rebaixa seus tipos via `toForeignKeyType` e as grava como colunas
  `${propertyName}_${pk.propertyName}` na linha local. Para um `@OneToMany`, essa é a tabela
  errada — a FK pertence ao lado *alvo*.
- **`Repository.create` e `Repository.update` iteram `meta.relations` cegamente** e escrevem em
  `relation.columns!` (`repository.ts:111-120` e `:173-182`). Para um `@OneToMany` não há colunas
  FK locais para escrever — essas passagens precisam filtrar por `relationType` (ou pular quando
  `columns` for null/vazio).
- **`Database.createRelations()` emite `ALTER TABLE ... ADD FOREIGN KEY` contra a tabela
  *local*** (`database.ts:122-150`). Para `@OneToMany`, a constraint de FK deveria ser emitida no
  lado *inverso* (`@ManyToOne`) — ou seja, o mesmo statement, mas originado de um `EntityMetadata`
  diferente.
- **Não existe carregamento em tempo de fetch.** `Repository.findMany` / `findOne` não seguem
  relações de forma alguma (sem `JOIN`, sem segunda query). Então a questão "lazy vs eager
  loading" para to-many não tem um padrão existente para herdar — precisa ser inventada. É também
  por isso que o OOR pode exibir o [N+1 Problem](../concepts/n-plus-one.md) *hoje* nas relações
  `@ToOne` existentes: um usuário iterando resultados de `findMany()` e chamando `findById()`
  por linha reproduz exatamente o anti-padrão que o
  [REFORMULATOR](../research/reformulator-n-plus-one.md) refatora, sem nenhuma opção de eager
  loading para oferecer no lugar.

## Esboço do espaço de design

Cinco eixos que o design precisa decidir. Nenhum é endossado aqui.

### Eixo 1 — Forma do decorator

- **`@OneToMany` + `@ManyToOne` pareados** (TypeORM, MikroORM). O lado dono declara
  `@ManyToOne(() => User) author: User` e escreve a FK; o lado inverso declara
  `@OneToMany(() => Post, post => post.author) posts: Post[]` e fica sem FK. Mais explícito,
  duas pastas de decorator novas.
- **`@OneToMany` só-inverso com `@ManyToOne` auto-inferido** — declara a coleção no pai; o OOR
  infere o `@ManyToMany` faltante no filho lendo o thunk do back-pointer. Superfície menor, mas
  exige uma *passagem de resolução* sobre os dois lados em tempo de resolução de metadados.
- **Sem `@OneToMany`; exigir que usuários declarem só o `@ToOne` inverso.** Pula o decorator
  inteiro. Rápido de entregar, mas deixa a classe pai incapaz de tipar seu campo
  `posts: Post[]` como relação — derrota boa parte do propósito.

### Eixo 2 — Como expressar o back-pointer

- **Lambda referenciando a propriedade inversa** (`@OneToMany(() => Post, post => post.author)`).
  Type-safe, amigável a refactor. Mesma forma usada pelo
  [thunk de alvo](../concepts/relations.md) para o thunk direto.
- **Nome string da propriedade inversa**
  (`@OneToMany({ target: () => Post, inverseSide: "author" })`). Mais simples de fazer parse;
  perde type safety no nome inverso.
- **Inferido de um símbolo único compartilhado** (ex.: ambos os decorators referenciam a mesma
  `relationKey`). Mais esperto; menos legível.

### Eixo 3 — Estratégia de carregamento

- **Lazy — query separada no acesso.** Um campo `Post[]` começa undefined; lê-lo dispara
  `findMany({ where: { author: parent.id } })`. Compõe naturalmente com o
  [Lazy Query Builder](../concepts/lazy-query-builder.md). Arrisca N+1 por default.
- **Eager via opt-in `relations: ["posts"]` em `FindOptions`.** Estilo TypeORM. Adiciona um
  terceiro campo de topo a `FindOptions<T>` (ao lado de `where` e `inheritance`).
- **Sempre eager.** Semântica mais simples, pior performance. Quase certamente errado, mas vale
  listar por completude.

### Eixo 4 — JOIN vs segunda query ao carregar avidamente

- **`LEFT JOIN` único com inflação do row-set em TypeScript** — um round-trip; colunas do pai
  duplicadas no resultado; precisa de uma passagem de deduplicação depois.
- **Duas queries: IDs dos pais primeiro, depois `WHERE child.fk IN (...)`** — dois round-trips;
  mapeamento mais limpo; melhor com linhas de pai largas. O padrão que o relational query builder
  do Drizzle usa.

> **Duas fontes externas apontam para a estratégia de duas queries.** O benchmark
> [JCSI 2025](../research/orm-frameworks-node-jcsi-2025.md) mediu as três formas de leitura
> aninhada ao vivo: o LEFT JOIN único do Sequelize, a costura de duas queries do Prisma e a dedup
> por subquery do TypeORM — a do TypeORM foi a **mais lenta** em todo modo de carga. E o
> [REFORMULATOR (ASE '22)](../research/reformulator-n-plus-one.md) refatora queries por linha em
> loop exatamente para a forma **duas queries + `.find`/`.filter` em memória**, preservando
> comportamento em 44 casos reais com acelerações de até 38,58× em escala. Nenhum dos dois
> estuda o OOR, mas juntos fazem de **`relations: [...]` opt-in resolvido via uma segunda query
> em lote** o default com melhor evidência para o OOR. Ver
> [concepts/n-plus-one.md](../concepts/n-plus-one.md). Nenhuma decisão registrada ainda.

### Eixo 5 — Cascade no delete

- **Sem cascade — erro se o pai tem filhos** (default `RESTRICT` do PostgreSQL). Mais seguro;
  empurra a escolha para o usuário.
- **`ON DELETE CASCADE` configurável por relação.** Casa com o que ORMs maduros entregam.
- **Sempre cascade.** Surpreendente; quase certamente errado.

## Coisas a verificar antes de decidir

- **Prior art.** TypeORM entrega `@OneToMany` / `@ManyToOne` pareados com thunk `inverseSide`
  obrigatório; MikroORM idem; Drizzle usa um DSL de builder relacional inteiramente fora do
  sistema de decorators. Vale uma página de [comparação](../comparisons/README.md) antes de
  comprometer — a decisão interage com como o OOR se posiciona estilisticamente.
- **Forma de tipos do campo de coleção.** Hoje `@ToOne` tipa o campo como `TType | undefined`.
  Para `@OneToMany` deveria ser `TType[] | undefined` (lazy) ou `TType[]` (sempre populado).
  Decidir, e garantir que o tipo se alinha com como o carregamento é implementado.
- **Interação com [Single-Table Inheritance](../concepts/single-table-inheritance.md).** Se o
  lado inverso é uma subclasse STI, o `WHERE fk = ?` auto-emitido deveria também empilhar um
  predicado de discriminador, para não puxar irmãos. A maquinaria já existe em `applyOptions` —
  só precisa ser ligada.
- **Interação com a geração automática de FK em `resolveRelations`.** Essa passagem roda
  incondicionalmente hoje; para `@OneToMany` deveria pular a geração de colunas no lado local e
  (talvez) verificar que o `@ManyToOne` inverso está presente. Decidir se a ausência é erro ou
  gatilho de inferência.
- **Onde `Database.createRelations()` emite o `ALTER ADD FOREIGN KEY`.** A constraint pertence
  logicamente ao lado dono da FK. O loop atual itera as relações da entidade local; para um
  to-many, o statement de FK tem de vir das relações da entidade *inversa*. Ou filtrar por
  `relationType === TO_ONE` (e deixar a declaração `@ManyToOne` dirigir a emissão), ou mudar o
  loop para percorrer cada entidade uma vez e emitir constraints de FK só quando
  `columns !== null`.
- **O filtro do caminho de escrita do repositório.** `Repository.create` e `update` precisam de
  uma guarda `relation.relationType === RelationType.TO_ONE` (ou equivalentemente
  `relation.columns !== null`) antes de escrever valores de FK. Sem ela, `relation.columns!` vai
  lançar em runtime quando `@OneToMany` aterrissar.

## O que mudaria no codebase

Superfície aproximada de mudança para `@OneToMany` + `@ManyToOne` pareados, lazy loading, sem
cascade por default:

- **Novo `src/decorators/relation/many-to-one.ts`** — lado dono. Mesma forma de `ToOne`, mas a
  entrada de metadados usa `relationType: TO_ONE` (o lado dono da FK realmente *é* um to-one no
  modelo de metadados — só existe um pai). Pode virar literalmente um alias de `ToOne` com nome
  mais claro.
- **Novo `src/decorators/relation/one-to-many.ts`** — lado inverso. Declara
  `relationType: TO_MANY`, captura o thunk da propriedade inversa e grava uma entrada
  `RelationMetadata` com `columns: null` permanentemente (sem FK local).
- **`src/core/metadata/metadata.ts`** — estender `RelationMetadata` com
  `inverseSide?: () => string` (ou similar). Atualizar `resolveRelations` para pular a geração
  automática de FK em entradas `TO_MANY` e validar que cada `TO_MANY` tem um `TO_ONE` casado no
  lado alvo.
- **`src/core/repository/repository.ts`** — guardar os dois blocos `meta.relations.forEach` em
  `:111` e `:173` com `relation.relationType === RelationType.TO_ONE`. Fora isso, inalterado na
  v1 (ainda sem eager loading em `findOne`/`findMany`).
- **`src/core/database/database.ts`** — `createRelations()` pula entradas `TO_MANY` (não são
  donas de FK); a lógica existente de emissão de FK continua correta para `TO_ONE` /
  `MANY_TO_ONE`.
- **`src/core/query-builder/`** — método novo em `QueryBuilder` (ou `Repository`) para carregar a
  coleção: `repo.loadRelation(parent, 'posts')` ou opt-in eager via `FindOptions.relations`. A
  API exata depende do Eixo 3 / Eixo 4.
- **Testes** — round trip só-lado-dono (semântica `@ToOne` existente, apenas renomeada); carga
  da coleção inversa; comportamento de cascading delete; lado inverso STI; o invariante
  `RelationMetadata.columns === null` para `TO_MANY`.
- **Docs** — novas páginas de componente; preencher a lacuna de `examples/relations/` como o site
  canônico de uso; atualizar [concepts/relations.md](../concepts/relations.md) para cobrir o
  thunk de propriedade inversa; atualizar [overview.md](../overview.md).

## O que fecharia esta questão

Uma decisão em cada eixo acima mais uma implementação entregue. Pela convenção desta
documentação (`open → answered`), esta questão fica aberta até a escolha de design estar travada
*e* o código estar na main. Saídas prováveis: um ADR novo (`0009-to-many-relations` ou similar),
dois componentes de decorator novos e uma expansão substancial de `examples/relations/`.

## Confiança

**Aberta** — sem decisão, sem código. O enum de metadados já reserva `TO_MANY`, mas todo caminho
de código que consome `RelationMetadata` hoje assume `TO_ONE` silenciosamente. Registrada porque
(a) a lacuna é a omissão mais perguntada de qualquer biblioteca em forma de ORM, (b) a escolha de
design restringe [support-many-to-many](support-many-to-many.md), e (c) a decisão é grande o
bastante — cinco eixos, dois decorators novos, três pontos de contato em módulos core — para
merecer ADR próprio em vez de ser contrabandeada para dentro de outra mudança.

## Questões relacionadas

- [support-many-to-many](support-many-to-many.md) — depende da resolução daqui; o padrão clássico
  decompõe M:N em duas metades O:M sobre uma tabela de junção.
- [support-user-indexes](support-user-indexes.md) — colunas FK são candidatas óbvias a índice;
  uma política de nomes que aterrisse lá deveria cobrir também os índices de FK implicados por
  `@ManyToOne`.
