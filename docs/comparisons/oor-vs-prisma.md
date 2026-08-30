# OOR vs Prisma

> **Veredito.** O sucesso do Prisma fez de schema-first + codegen a expectativa default para ORMs
> tipados. O OOR propõe a alternativa que o campo subexplorou: o próprio TypeScript como schema,
> sem DSL, sem etapa de codegen e sem artefatos gerados. A contribuição é um query builder fluente
> e componível sobre entidades declaradas como classes — um caminho que o design do Prisma fechou
> e que se revela valer a pena manter aberto.

## O que o OOR traz de novo

- **TypeScript como fonte única da verdade.** Sem DSL `schema.prisma`, sem etapa
  `prisma generate`, sem pasta de cliente gerado para gerenciar. A classe TypeScript decorada é,
  ao mesmo tempo, os metadados de runtime e o tipo estático.
  ([concepts/stage-3-decorators.md](../concepts/stage-3-decorators.md))
- **Um `QueryBuilder<T>` fluente, componível e lazy.** O builder acumula cláusulas
  (`where` / `orderBy` / `limit` / `offset`) e só executa no terminal — queries podem ser
  construídas e refinadas incrementalmente. O `findMany({ where, include, orderBy })` do Prisma é
  um argumento de literal de objeto sem refinamento encadeável.
- **Single-Table Inheritance nativa.** O Prisma documenta STI como padrão de userland (gerencie o
  discriminador você mesmo, escreva suas próprias queries); o RFC de relações polimórficas está
  aberto desde o Prisma 1. O OOR entrega STI derivada da cadeia de protótipos, com resolução lazy
  e índice de discriminador auto-emitido.
  ([concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md))
- **Segurança de SQL dura.** O Prisma expõe `$queryRawUnsafe` como escotilha documentada; o OOR
  não tem equivalente e bane `sql.unsafe` no codebase inteiro.
  ([ADR 0004](../decisions/0004-parameterized-sql-only.md))
- **Zero etapa de build no loop de desenvolvimento.** Adiciona um `@Column`, roda os testes. Sem
  `prisma generate`, sem cliente regerado, sem arquivo out-of-band para commitar-ou-gitignorear.

## Visão geral

O Prisma é o ORM JavaScript mais instalado e a força dominante na categoria "schema-first +
cliente gerado". Seu pivô arquitetural de 2025–2026 (Query Compiler TypeScript livre de Rust na
v7) aposentou a crítica histórica de "Prisma é pesado em runtime", o que afia a comparação: o que
resta é uma bifurcação filosófica limpa entre *schema-como-DSL* e *schema-como-código*.

> **O OOR explora o caminho que o design do Prisma fechou.** A escolha do Prisma de colocar o
> schema na própria DSL foi uma resposta coerente a "onde o schema deveria viver?". Produziu um
> produto forte, e eliminou uma alternativa que o ecossistema TypeScript subexplorou:
> classes-como-schema com um builder fluente componível. O OOR é o argumento longo de que essa
> alternativa valia a pena ser mantida aberta.

## Comparação

> **Regra de valor equivalente para features planejadas.** Features planejadas com página de
> questão em aberto totalmente circunscrita aparecem abaixo como parte da contribuição do OOR.

| Dimensão | OOR | Prisma (v7) |
| --- | --- | --- |
| **Fonte da verdade** | Classes TypeScript decoradas — a classe *é* o schema, em TypeScript. Sem DSL, sem artefatos gerados, sem arquivo separado para manter em sincronia. | `schema.prisma` — um arquivo DSL separado. Os tipos TypeScript são *gerados a partir* da DSL. |
| **Linguagem de schema** | TypeScript + decorators Stage-3. ([concepts/stage-3-decorators.md](../concepts/stage-3-decorators.md)) | Prisma Schema Language (PSL) — gramática própria com `model`, `datasource`, `generator`, decorators de atributo (`@id`, `@unique`, `@@index`). |
| **Codegen** | Nenhum. Decorators populam metadados de runtime via [MetadataStorage](../components/metadata-storage.md) em tempo de carga do módulo. | Etapa `prisma generate` obrigatória. Produz um cliente tipado numa pasta de saída configurável. Mudanças de schema exidem regeração. |
| **API de ponto de entrada** | `Repository<T>` por entidade — seis métodos executam diretamente; a composição mora no callback `where` / `FindOptions<T>`. ([concepts/repository-pattern.md](../concepts/repository-pattern.md), [ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md)) | `prisma.<modelName>` — métodos namespacados por modelo num cliente único (`prisma.user.findMany`, `prisma.post.create`). Sem forma `Repository<T>`; lógica por entidade é userland. |
| **Forma de query** | Callback tipado: `userRepo.findMany({ where: (u) => [u.createdAt!.gt(since)] })`; o builder interno tem cláusulas fluentes `orderBy` / `limit` / `offset`. | Literal de objeto por chamada: `prisma.user.findMany({ where: { createdAt: { gt: since } }, orderBy: { createdAt: "desc" }, take: 5 })` |
| **Composição** | O `QueryBuilder<T>` lazy acumula cláusulas e executa só no terminal; refinamento incremental dentro do callback `where` tipado. ([concepts/lazy-query-builder.md](../concepts/lazy-query-builder.md)) | Uma query parcialmente montada é um `Prisma.UserFindManyArgs` (um tipo de literal de objeto) — espalhável, mas não encadeável nem refinável. |
| **Segurança de SQL** | `sql.unsafe` banido no codebase inteiro. Sem interpolação crua em lugar nenhum — sem escotilha nos internals da biblioteca nem no código do usuário. ([ADR 0004](../decisions/0004-parameterized-sql-only.md)) | Dois níveis: `$queryRaw` / `$executeRaw` (tagged templates, parametrizados) e `$queryRawUnsafe` / `$executeRawUnsafe` (concatenação de strings, explicitamente inseguros — documentados, mas disponíveis). |
| **Estricção de tipos** | No-`any` estrito enforced via lint. API pública usa generics + tipos condicionais. ([ADR 0005](../decisions/0005-no-any-type-driven-api.md)) | Cliente gerado é totalmente tipado; sem postura documentada de "no-`any`", mas a superfície pública é estrita na prática. |
| **Índices** | ⏳ `@Index` e `@Unique` em nível de propriedade + classe, com política de nomes uniforme que também cobre o índice de discriminador STI. Circunscrito em [questions/support-user-indexes.md](../questions/support-user-indexes.md). | Primeira classe na PSL: `@unique`, `@@unique`, `@@index`. Composto, nomeado, funcional, direção, tipos de índice do Postgres. |
| **Herança** | Single-Table Inheritance com coluna discriminadora, derivada da cadeia de protótipos, índice de discriminador auto-emitido, `FindOptions.inheritance` (`ALL` / `ONLY` / `SUBCLASSES`). ([concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md)) | Sem STI nativa. Padrões de userland (gerencie o discriminador você mesmo); RFC de relações polimórficas aberto desde a v1. |
| **Escopo de banco** | PostgreSQL, profundamente. [Enum `COLUMN_TYPE`](../components/sql-types.md) fechado de 47 membros; regras de tipos específicas de PG no nível de tipos. | PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, MongoDB, CockroachDB via driver adapters. |
| **Toolchain** | Só Bun. ([ADR 0007](../decisions/0007-bun-toolchain.md)) | Node primário; runtimes de edge (Cloudflare Workers, Vercel Edge, Lambda) de primeira classe desde a v7. |

## A contribuição do OOR, dimensão por dimensão

### TypeScript como fonte única da verdade

O design do Prisma divide o schema entre duas linguagens:

```prisma
// schema.prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}
```

...depois `npx prisma generate`, depois `import { PrismaClient } from "./generated/client"`.
Produz um produto forte — e amarra toda mudança de schema a uma etapa de build, um arquivo-fonte
out-of-band em outra linguagem e um artefato gerado cujo versionamento ("commit ou gitignore?") é
uma decisão que o time precisa tomar.

O OOR coloca o schema em TypeScript:

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
  email!: string;
}
```

Sem DSL, sem etapa de codegen, sem pasta gerada, sem arquivo out-of-band. A classe funciona como
valor (instancie-a, chame métodos nela) e como tipo (`User` numa assinatura de função). A evolução
do schema acontece no mesmo loop de todo o resto: edita o arquivo, roda os testes. É a
contribuição mais consequente do OOR contra o Prisma: o caminho "TypeScript como schema" foi
fechado pela escolha de design do Prisma, e o ecossistema TypeScript o subexplorou.

### Queries componíveis e encadeáveis

A API de query do Prisma é uma função por operação, com literal de objeto:

```ts
const recent = await prisma.user.findMany({
  where: { createdAt: { gt: since } },
  orderBy: { createdAt: "desc" },
  take: 5,
});
```

Para uma query trivial, é compacto e agradável. O custo aparece na **composição**: uma query
parcialmente montada é um `Prisma.UserFindManyArgs` (tipo de literal de objeto) — dá para
espalhar cláusulas `where` parciais entre helpers, mas não dá para retornar um valor de "query
refinada até aqui" e deixar o caller encadear mais condições.

O `QueryBuilder<T>` lazy do OOR é construído para refinamento incremental: acumula `where`,
`orderBy`, `limit`, `offset` e executa apenas na chamada terminal (`getMany()` / `getOne()`). No
OOR, a superfície de composição exposta ao usuário hoje é o callback `where` tipado de
`FindOptions`; o builder completo é uma escotilha interna (construção direta), e expô-lo
diretamente é uma extensão deliberada possível sem mudar o invariante de laziness. Ver
[concepts/lazy-query-builder.md](../concepts/lazy-query-builder.md) e
[components/query-builder.md](../components/query-builder.md).

### `Repository<T>` como ponto de entrada

A superfície por entidade do Prisma é `prisma.<modelName>.<verb>()`. Não há abstração
`Repository<T>`; se um projeto quer métodos de serviço por entidade, constrói uma camada de
repositório userland por cima do cliente Prisma — receita recorrente no ecossistema Prisma.

O OOR faz dessa camada a API primária: `Repository<T>` com superfície fechada de seis métodos
(`findMany`, `findOne`, `findById`, `create`, `update`, `delete`). Lógica por entidade tem casa
natural; não precisa ser reinventada por projeto.

### Single-Table Inheritance nativa

A página oficial de "Table inheritance" do Prisma recomenda três padrões de userland; nenhum é
nativo — cada um é um padrão que o usuário implementa por cima do cliente gerado. O RFC de
relações polimórficas está aberto desde o Prisma 1.

O OOR entrega STI como primeira classe: subclasses `@Entity` que estendem uma raiz decorada
mapeiam para a tabela da raiz com coluna discriminadora auto-emitida (mais índice), resolução
lazy, e um parâmetro `FindOptions.inheritance` (`InheritanceSearchType`: `ALL` / `ONLY` /
`SUBCLASSES`) controlando quais subclasses uma query cobre. Para aplicações que modelam
hierarquias polimórficas, é uma feature sem equivalente no Prisma — não "o Prisma faz diferente",
mas "o usuário tem de construir sozinho".

### Segurança de SQL dura

A história de segurança do Prisma é de dois níveis e explícita:

```ts
await prisma.$queryRaw`SELECT * FROM "User" WHERE email LIKE ${pattern}`; // seguro
await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}" LIMIT 10`); // inseguro
```

A fronteira é bem marcada — melhor que bibliotecas com caminhos inseguros implícitos — mas o
caminho inseguro existe e vai para produção em código Prisma regularmente.

A postura do OOR ([ADR 0004](../decisions/0004-parameterized-sql-only.md)) é que até um caminho
inseguro documentado é confiança demais: o próximo mantenedor copia o padrão sem o aviso. Não há
equivalente a `$queryRawUnsafe` no OOR. Identificadores dinâmicos passam por allowlists; os
internals da biblioteca também não podem usar o caminho inseguro, por lint e por convenção. SQL
injection é tratada como propriedade de corretude inegociável, não disciplina.

### Zero etapa de build

`prisma generate` é rápido, mas ainda é uma etapa. Para um desenvolvedor TypeScript acostumado ao
loop interno de "edita uma classe, roda testes, vê resultados", cada etapa adicional compõe:
tooling precisa saber quando regerar, IDEs precisam atualizar, artefatos gerados precisam ficar
consistentes entre membros do time e CI. O OOR não tem codegen: decorators populam metadados em
tempo de carga do módulo. Edita a classe, roda `bun test`, vê o resultado.
([ADR 0007](../decisions/0007-bun-toolchain.md))

### PostgreSQL, profundamente

A arquitetura de adapters do Prisma achata ao mínimo denominador comum entre sete bancos.
Affordances específicos de PG (índices de expressão, índices parciais, operadores `JSONB`) viram
escotilhas ou não são suportados (índices parciais não são expressíveis em PSL). O enum
`COLUMN_TYPE` do OOR é fechado e em formato PG; affordances específicos de PG são tipos de
primeira classe. O estreitamento de escopo é a contribuição: regras de tipos PG viram parte do
contrato em vez de cola de adapter.

## Por que o OOR importa num mercado cheio

A escolha de design do Prisma — schema-como-DSL, codegen-como-geração, chamadas namespacadas por
modelo — produziu um produto que definiu uma categoria. Também definiu o caminho que se *espera*
que ORMs TypeScript tomem. O caminho que ela não tomou — schema-como-código, metadados em
runtime, builder fluente componível sobre entidades-classe — ficou mal servido no ecossistema
desde a ascensão do Prisma.

A contribuição do OOR é levar esse caminho a sério. O modelo classe-como-schema, o
`QueryBuilder<T>` lazy, a STI nativa e o loop de desenvolvimento sem codegen não são refinamentos
do design do Prisma — são uma alternativa para a qual o campo tinha espaço e não entregou. A
alegação do TCC é que a alternativa vale ser entregue.

## Fontes

- Documentação do Prisma: <https://www.prisma.io/docs>
- Anúncio do Prisma 7: <https://www.prisma.io/blog/announcing-prisma-orm-7-0-0>
- Migração Rust→TypeScript: <https://www.prisma.io/blog/from-rust-to-typescript-a-new-chapter-for-prisma-orm>
- Documentação de table inheritance: <https://www.prisma.io/docs/orm/prisma-schema/data-model/table-inheritance>
- Repositório: <https://github.com/prisma/prisma>
- ADRs do OOR: [0001](../decisions/0001-stage-3-decorators.md),
  [0002](../decisions/0002-repository-with-lazy-query-builder.md),
  [0004](../decisions/0004-parameterized-sql-only.md),
  [0005](../decisions/0005-no-any-type-driven-api.md)
