# Decisões de Arquitetura (ADRs)

Architecture Decision Records. Cada ADR registra uma decisão de design **estrutural** e sua
justificativa. Decisões novas são acrescentadas em sequência; decisões substituídas são marcadas
como `superseded` com link para a substituta — nunca reescritas.

## Índice

| ADR | Decisão | Status | Data |
| --- | --- | --- | --- |
| [0001](0001-stage-3-decorators.md) | Usar decorators ECMAScript Stage-3; rejeitar `experimentalDecorators` + `reflect-metadata` | aceita | 2026-04-29 |
| [0002](0002-repository-with-lazy-query-builder.md) | `Repository<T>` como ponto de entrada; composição via `QueryBuilder<T>` lazy | aceita | 2026-04-29 |
| [0003](0003-singleton-di-container.md) | Container de DI singleton, intencionalmente mínimo | aceita (não implementada) | 2026-04-29 |
| [0004](0004-parameterized-sql-only.md) | Somente SQL parametrizado; `sql.unsafe` banido em todo o código | aceita | 2026-04-29 |
| [0005](0005-no-any-type-driven-api.md) | `no-explicit-any` estrito; API pública orientada a tipos | aceita | 2026-04-29 |
| [0006](0006-tdd-rhythm.md) | TDD como ritmo de implementação, com `bun test` | aceita | 2026-04-29 |
| [0007](0007-bun-toolchain.md) | Bun como toolchain único | aceita | 2026-04-29 |
| [0008](0008-pk-aware-compile-time.md) | Brand `PrimaryKey<V>` para enforcement de PK em tempo de compilação | aceita | 2026-04-30 |

## Convenção

- Nome de arquivo: `NNNN-titulo-curto.md`, com `NNNN` sequencial preenchido com zeros.
- Cada ADR tem: **Contexto**, **Decisão**, **Consequências** (positivas / negativas / neutras) e
  **Alternativas consideradas**.
- Quando a implementação divergir da decisão original, a divergência é registrada em uma nota de
  implementação dentro do próprio ADR — o histórico da decisão não é apagado.
