# Documentação — Order of Relations (OOR)

Documentação canônica do projeto. Consolida e substitui a wiki experimental gerada por plugin em
`docs/vault/OOR/wiki/` (Obsidian; o vault em si vive no repositório irmão
`order-of-relations-vault`, linkado por symlink e fora do git).

## Mapa

| Documento | Conteúdo |
| --- | --- |
| [overview.md](overview.md) | Resumo executivo: o que é o OOR, regras duras, arquitetura em cinco camadas, fatos sobre a forma dos métodos. **Comece aqui.** |
| [architecture.md](architecture.md) | Visão em camadas e os quatro fluxos: registro de entidade, lifecycle de uma query, lifecycle de um `create()`, schema create/drop. |
| [examples.md](examples.md) | Os cenários executáveis em `examples/` (basic-crud, inheritance; relations como lacuna). |
| [class-diagram.md](class-diagram.md) | Diagrama de classes (Mermaid) do `src/`. |

### [components/](components/) — as classes centrais, com contratos

- [database.md](components/database.md) — hospedeiro de conexão, metadados e ciclo de vida do schema.
- [metadata-storage.md](components/metadata-storage.md) — o `Map<Constructor, EntityMetadata>` por-`Database`.
- [repository.md](components/repository.md) — os seis métodos, o portão `requirePrimaryKey`, o contrato de `create()`.
- [query-builder.md](components/query-builder.md) — estado, mutabilidade, `applyOptions`, terminais, composição de SQL.
- [sql-types.md](components/sql-types.md) — o enum `COLUMN_TYPE` (47 tipos PG) e o rebaixamento de tipos FK.

### [concepts/](concepts/) — os conceitos de design

Fundamentais: [stage-3-decorators](concepts/stage-3-decorators.md) ·
[repository-pattern](concepts/repository-pattern.md) ·
[lazy-query-builder](concepts/lazy-query-builder.md) ·
[conditions-proxy](concepts/conditions-proxy.md) ·
[parameterized-sql](concepts/parameterized-sql.md) (inclui `sqlJoin`) ·
[single-table-inheritance](concepts/single-table-inheritance.md) ·
[relations](concepts/relations.md) (`@ToOne`, thunk, rebaixamento de FK) ·
[autogeneration](concepts/autogeneration.md) ·
[primary-key-brand](concepts/primary-key-brand.md) ·
[schema-migrations](concepts/schema-migrations.md) (planejado) ·
[di-container](concepts/di-container.md) (planejado)

Contexto de campo: [orm-patterns](concepts/orm-patterns.md) (Active Record vs. Data Mapper) ·
[n-plus-one](concepts/n-plus-one.md) (N+1, eager loading, taint analysis) ·
[hierarchical-data-models](concepts/hierarchical-data-models.md) ·
[connection-pooling](concepts/connection-pooling.md)

### [decisions/](decisions/) — ADRs

[Índice](decisions/README.md) · [0001 Stage-3](decisions/0001-stage-3-decorators.md) ·
[0002 Repository + QueryBuilder lazy](decisions/0002-repository-with-lazy-query-builder.md) ·
[0003 DI singleton](decisions/0003-singleton-di-container.md) ·
[0004 SQL parametrizado](decisions/0004-parameterized-sql-only.md) ·
[0005 no-any](decisions/0005-no-any-type-driven-api.md) ·
[0006 TDD](decisions/0006-tdd-rhythm.md) ·
[0007 Bun](decisions/0007-bun-toolchain.md) ·
[0008 brand PrimaryKey](decisions/0008-pk-aware-compile-time.md)

### [questions/](questions/) — questões em aberto e respondidas

[Índice](questions/README.md) — 7 abertas (one-to-many, and/or, many-to-many, ordem de
decorators, índices de usuário, acumulação em `applyOptions`, colisão `idx_discriminator`) e 1
respondida ([get-one-limit-1](questions/get-one-limit-1.md)).

### [comparisons/](comparisons/) — posicionamento (material de defesa do TCC)

[Convenção](comparisons/README.md) · [matriz resumo](comparisons/orms-summary.md) ·
[vs TypeORM](comparisons/oor-vs-typeorm.md) · [vs Prisma](comparisons/oor-vs-prisma.md) ·
[vs Drizzle](comparisons/oor-vs-drizzle.md) ·
[Stage-3 vs legado](comparisons/stage-3-vs-legacy-decorators.md)

### [research/](research/) — base bibliográfica

- [orm-frameworks-node-jcsi-2025.md](research/orm-frameworks-node-jcsi-2025.md) — benchmark JCSI
  2025 (Sequelize × Prisma × TypeORM).
- [reformulator-n-plus-one.md](research/reformulator-n-plus-one.md) — REFORMULATOR (ASE '22),
  refatoração automatizada de N+1.

## Convenções desta documentação

- **Sem frontmatter, wikilinks ou callouts do Obsidian.** Markdown padrão; links relativos comuns.
- **A canônica segue o código, não o contrário.** Afirmações sobre API refletem o estado atual de
  `src/` na `main`. Divergências conhecidas da wiki antiga foram corrigidas na migração (ex.: não
  existe `Repository.find()`; `QueryBuilder` tem `orderBy`/`limit`/`offset`; `getOne()` emite
  `LIMIT 1`).
- **Features planejadas são marcadas** com nota de "não implementado" / "⏳ planejado" e link para
  a questão em aberto correspondente.
- **ADRs não são reescritos** — divergências posteriores entram como nota de implementação no
  próprio ADR (ver [decisions/README.md](decisions/README.md)).
