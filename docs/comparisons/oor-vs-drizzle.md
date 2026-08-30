# OOR vs Drizzle

> **Veredito.** O Drizzle provou que inferência forte de TypeScript basta para fazer uma API em
> formato SQL parecer segura. O OOR faz uma aposta diferente: que a ergonomia de classes
> decoradas — entidade-como-tipo, Repository-como-ponto-de-entrada, STI nativa — vale ser mantida,
> e que pode ser pareada com a mesma inferência forte e as mesmas garantias de SQL parametrizado.
> A contribuição é o perfil ergonômico OO, modernizado.

## O que o OOR traz de novo

- **Classe-como-schema, não valor-como-schema.** No OOR, `User` é ao mesmo tempo a classe de
  entidade em runtime e o tipo estático — métodos e validação podem pendurar nela. No Drizzle,
  `users` é um valor de runtime (um descritor de tabela) e o tipo é uma etapa de inferência
  separada (`typeof users.$inferSelect`).
- **Um ponto de entrada `Repository<T>` com fronteira limpa simples-vs-composto.** O Drizzle não
  tem abstração Repository — há o builder core de baixo nível e uma camada opt-in de Relational
  Queries; usuários ou buscam helpers em formato SQL ou aprendem a forma de mais alto nível. O
  OOR se compromete com uma entrada por entidade.
  ([ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md))
- **Uma API de predicados tipada em vez de helpers SQL importados.** `cb.email!.eq(value)` em vez
  de `eq(users.email, value)` — tipos de coluna são accessors num proxy tipado, não argumentos de
  funções livres. O usuário nunca importa `eq`, `and`, `or`, `gt`, `lt`.
  ([concepts/conditions-proxy.md](../concepts/conditions-proxy.md))
- **Single-Table Inheritance nativa.** O Drizzle não tem — feature request aberto desde os
  primórdios do projeto; o workaround de userland são objetos de definição de coluna
  compartilhados espalhados em múltiplas tabelas, o que não é STI. O OOR entrega STI com
  discriminador, índice auto-emitido e resolução lazy.
  ([concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md))
- **Segurança de SQL dura, não só segura-por-default.** O `` sql`...` `` do Drizzle é
  parametrizado, mas `sql.raw(...)` existe como escotilha documentada. O OOR não tem escotilha
  equivalente — o caminho inseguro é proibido nos internals da biblioteca e no código do usuário.
  ([ADR 0004](../decisions/0004-parameterized-sql-only.md))

## Visão geral

O Drizzle é o exemplar de uma filosofia de ORM diferente: dobrar o sistema de tipos para caber no
SQL. Schemas são objetos table-builder de runtime (`pgTable("users", { ... })`); queries são em
formato SQL (`db.select().from(users).where(eq(users.id, 1))`); tipos são inferidos do schema em
vez de declarados numa classe. É um design coerente e o Drizzle o executa bem.

O OOR faz a aposta oposta. Schemas são classes TypeScript decoradas; queries fluem por um
`Repository<T>` e um proxy de predicados tipado; a declaração da classe *é* ao mesmo tempo os
metadados de runtime e o tipo estático. A contribuição não é "o Drizzle está errado" — é "o
perfil ergonômico OO (entidade-como-tipo, métodos em entidades, ponto de entrada único por
entidade, polimorfismo nativo) valia ser mantido, e pode ser pareado com as mesmas garantias
modernas que o Drizzle alcança".

> **Duas respostas coerentes à mesma pergunta.** "Como obter acesso type-safe ao PostgreSQL a
> partir do TypeScript?" O Drizzle responde tipando o SQL. O OOR responde tipando as classes.
> Ambas funcionam; a comparação é sobre em qual perfil ergonômico um codebase TypeScript quer
> viver.

## Comparação

> **Regra de valor equivalente para features planejadas.** Features planejadas com página de
> questão em aberto totalmente circunscrita aparecem abaixo como parte da contribuição do OOR.

| Dimensão | OOR | Drizzle ORM (1.0-beta) |
| --- | --- | --- |
| **Declaração de schema** | Classes TypeScript decoradas. A classe *é* a forma da entidade; métodos e comportamento podem pendurar nela. ([concepts/stage-3-decorators.md](../concepts/stage-3-decorators.md)) | Objetos table-builder de runtime: `pgTable("users", { id: integer().primaryKey(), name: varchar().notNull() })`. Específicos por dialeto (`pgTable` vs `mysqlTable` vs `sqliteTable`). |
| **Derivação de tipos** | A declaração da classe é ao mesmo tempo os metadados de runtime e o tipo estático — `User` funciona como `class User` e como `type User`. Sem etapa de inferência. | Tipo estático **derivado** do schema de runtime via `typeof users.$inferSelect` / `$inferInsert`. Sem codegen, mas o tipo fica uma etapa de inferência afastado da declaração. |
| **API de ponto de entrada** | `Repository<T>` por entidade — o ponto de entrada único. Operações simples no `Repository`, composição via callback `where` / `FindOptions<T>`. ([concepts/repository-pattern.md](../concepts/repository-pattern.md)) | Sem `Repository<T>`. Duas camadas coexistindo: builder core de baixo nível (`db.select().from(users).where(eq(users.id, 1))`) e a API opt-in Relational Queries (RQB) (`db.query.users.findMany({ with: { posts: true } })`). |
| **Forma de query** | [Conditions Proxy](../concepts/conditions-proxy.md) tipado: `where(cb => [cb.firstName!.eq("Tony")])`. Sem strings SQL, sem helpers de operador — só accessors tipados por coluna. | Helpers em formato SQL importados de `drizzle-orm`: `where(eq(users.firstName, "Tony"))`, `and(...)`, `or(...)`, `gt(...)`, `lt(...)`, `inArray(...)`. |
| **Execução do builder** | Mutável, dono único. Lazy. Chamada terminal (`getMany()` / `getOne()`) executa. Cláusulas fluentes `orderBy` / `limit` / `offset`. ([concepts/lazy-query-builder.md](../concepts/lazy-query-builder.md)) | Thenable lazy — `await db.select()...` dispara a execução. |
| **Segurança de SQL** | `sql.unsafe` banido no codebase inteiro. Sem interpolação crua em lugar nenhum — sem escotilha nem nos internals da biblioteca. ([ADR 0004](../decisions/0004-parameterized-sql-only.md)) | `` sql`...${value}` `` é parametrizado. `sql.raw(...)` é a escotilha documentada — exige um keystroke deliberado, mas está disponível. |
| **Índices** | ⏳ `@Index` e `@Unique` em nível de propriedade + classe, com política de nomes uniforme que também cobre o índice de discriminador STI. Circunscrito em [questions/support-user-indexes.md](../questions/support-user-indexes.md). | Primeira classe. Terceiro argumento de `pgTable` retorna um array: `[index("name_idx").on(t.name), uniqueIndex("email_idx").on(t.email)]`. Composto, parcial, funcional, opclass, fillfactor — superfície de índices PG quase completa. |
| **Herança** | Single-Table Inheritance com coluna discriminadora, derivada da cadeia de protótipos, resolução lazy, índice de discriminador auto-emitido. ([concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md)) | Sem STI nativa. Feature request aberto; workaround de userland são objetos de definição de coluna compartilhados espalhados em múltiplas tabelas. |
| **Escopo de banco** | PostgreSQL, profundamente. [Enum `COLUMN_TYPE`](../components/sql-types.md) fechado de 47 tipos PG; regras de tipos específicas de PG (rebaixamento de FK) no nível de tipos. | Multi-dialeto: PostgreSQL, MySQL, SQLite, SingleStore, CockroachDB, MSSQL. Schemas são específicos por dialeto — mesmo arquivo TypeScript, mas `pgTable` ≠ `mysqlTable`. |
| **Toolchain** | Só Bun. Decorators Stage-3 nativos; `bun test` para TDD. ([ADR 0007](../decisions/0007-bun-toolchain.md)) | Suporte a Bun de primeira classe; runtimes de edge (Cloudflare Workers, Durable Objects, D1). CLI `drizzle-kit` para migrations. |

## A contribuição do OOR, dimensão por dimensão

### Classe-como-schema

No Drizzle:

```ts
export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar().notNull(),
});

export type User = typeof users.$inferSelect;
```

O schema (`users`) é um valor de runtime. O tipo (`User`) fica uma etapa de inferência distante.
Não há classe onde pendurar métodos — comportamento de entidade, validação, campos computados
vivem em outro lugar. É uma escolha deliberada, de inclinação FP, que serve bem a alguns
codebases.

No OOR:

```ts
@Entity(db)
class User {
  @PrimaryColumn({
    type: COLUMN_TYPE.SERIAL,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;

  // Métodos, validação, campos computados penduram aqui naturalmente
  fullName() {
    return this.name;
  }
}
```

A classe é ao mesmo tempo os metadados de runtime e o tipo estático. Comportamento vive onde os
dados vivem. Para codebases TypeScript de inclinação OO — que a linguagem continua suportando e a
biblioteca padrão continua modelando — é o perfil ergonômico que "encaixa".

### `Repository<T>` como ponto de entrada

A API core do Drizzle é intencionalmente em formato SQL:

```ts
const result = await db
  .select()
  .from(users)
  .where(and(eq(users.email, email), gt(users.createdAt, since)));
```

A camada Relational Queries (`db.query.users.findMany({ with: { posts: true } })`) é o análogo
mais próximo das leituras compostas do OOR, mas é uma superfície *adicional* empilhada sobre o
builder SQL, não o ponto de entrada. Um usuário precisa escolher, a cada query, qual forma de API
buscar.

O OOR colapsa isso. Por entidade, há um `Repository<T>`. Operações simples são métodos nele
(`findOne`, `findMany`, `findById`, `create`, `update`, `delete`); a composição mora no callback
`where` tipado e no `FindOptions<T>`. O usuário nunca precisa escolher uma camada.

### Proxy de predicados tipado

```ts
// OOR
userRepo.findMany({
  where: (cb) => [cb.email!.eq(email), cb.createdAt!.gt(since)],
});

// Drizzle
db.select()
  .from(users)
  .where(and(eq(users.email, email), gt(users.createdAt, since)));
```

Ambos compilam para o mesmo SQL parametrizado. A contribuição está em **onde os nomes de
operador vivem**: no OOR são métodos num proxy tipado (então `cb.email` conhece o tipo da coluna
e constrange o lado direito); no Drizzle são funções livres importadas de `drizzle-orm` e
chamadas com referências de coluna.

A leitura do OOR: uma coluna conhece seus próprios operadores. O proxy é auto-gerado a partir dos
metadados de coluna da entidade; o usuário nunca importa `eq`, `and`, `or`, `gt`, `lt`. Isso
mantém a superfície descobrível via autocomplete `cb.<tab>` em vez de via documentação, e
constrange operações tipo-incompatíveis no call site.

### Single-Table Inheritance nativa

Esta é a contribuição de feature mais clara do OOR na comparação. O Drizzle não tem STI nativa,
nem CTI nativa, nem relações polimórficas — o feature request aberto está pendente desde os
primórdios do projeto. O workaround de userland espalha definições de coluna compartilhadas por
múltiplas tabelas, o que é *tabela-por-classe com reuso de código*, não STI.

O OOR entrega STI como feature de primeira classe: subclasses `@Entity` que estendem uma raiz
decorada colapsam na tabela da raiz com discriminador auto-emitido (mais índice), resolução lazy
e um campo `FindOptions.inheritance` com `InheritanceSearchType` (`ALL` / `ONLY` / `SUBCLASSES`)
controlando quais subclasses uma query cobre. Para aplicações que modelam hierarquias
polimórficas — admins/usuários, produto-base/produto-especializado, atores por papel — não é
preferência de opinião; é uma feature que o Drizzle simplesmente não tem.

### Segurança de SQL dura

A história de segurança do Drizzle é "seguro por default, inseguro por keystroke deliberado":

```ts
// seguro — parametrizado
sql`SELECT * FROM users WHERE id = ${id}`;

// escotilha insegura explícita
sql.raw(userInput);
```

É uma melhoria real e documentada sobre bibliotecas com caminhos inseguros implícitos. O OOR vai
além: não há equivalente a `sql.raw`, e `sql.unsafe` é banido no codebase inteiro. Os internals
da biblioteca também não podem alcançá-lo. A classe de bugs de injeção que vai para produção
através de chamadas `sql.raw` em código Drizzle não consegue ir para produção através do OOR, por
construção. ([ADR 0004](../decisions/0004-parameterized-sql-only.md))

### PostgreSQL, profundamente

A promessa multi-dialeto do Drizzle é em nível de runtime (um codebase Drizzle pode mirar vários
bancos com arquivos de schema paralelos), não em nível de schema (um arquivo de schema mirando
vários bancos). `pgTable` e `mysqlTable` são funções diferentes com tipos de coluna disponíveis
diferentes.

O OOR não tenta ser portável. O módulo [sql-types](../components/sql-types.md) é em formato PG —
`SERIAL`, `JSONB`, `TIMESTAMPTZ` — e a lógica de rebaixamento de FK (`SERIAL → INTEGER`) é
comportamento específico de PG codificado no nível de tipos. O estreitamento de escopo é a
contribuição: affordances de PG viram tipos de primeira classe em vez de cola de adapter.

## Por que o OOR importa num mercado cheio

O sucesso do Drizzle mostrou que inferência forte de TypeScript consegue carregar uma API em
formato SQL ao mesmo destino que ORMs alcançam por outros meios. Isso não torna ORMs baseados em
decorators obsoletos — eleva a barra do que eles precisam entregar. Especificamente: precisam
empatar com o Drizzle em segurança de SQL, estricção de tipos e alinhamento de toolchain, e ainda
justificar o perfil ergonômico OO que trazem.

O argumento do OOR é que o perfil ergonômico OO *vale* ser trazido. Classe-como-schema,
métodos-em-entidades, ponto-de-entrada-único-por-entidade, polimorfismo nativo — não são só
preferências; são estruturais em codebases de inclinação OO do mesmo jeito que
valor-como-schema e helpers livres são estruturais nos de inclinação FP. A contribuição é atingir
a barra do Drizzle nas garantias modernas mantendo (e modernizando) o perfil ergonômico em que
ORMs de decorator sempre foram bons.

## Fontes

- Documentação do Drizzle: <https://orm.drizzle.team>
- Declaração de schema: <https://orm.drizzle.team/docs/sql-schema-declaration>
- Índices e constraints: <https://orm.drizzle.team/docs/indexes-constraints>
- Relational Queries: <https://orm.drizzle.team/docs/rqb>
- Segurança de SQL: <https://orm.drizzle.team/docs/sql>
- Repositório: <https://github.com/drizzle-team/drizzle-orm>
- Feature request de STI: <https://github.com/drizzle-team/drizzle-orm/issues/900>
- ADRs do OOR: [0002](../decisions/0002-repository-with-lazy-query-builder.md),
  [0004](../decisions/0004-parameterized-sql-only.md)
