# Architecture Decision Records

Este diretório preserva as decisões arquiteturais relevantes do projeto. Um
ADR explica o contexto e as alternativas avaliadas; o código e a documentação
de arquitetura descrevem o estado atual.

## Criando um ADR

1. Copie o [template](template.md).
2. Use o próximo identificador sequencial de quatro dígitos e um nome curto em
   minúsculas, separado por hífens: `0001-usar-decoradores-stage-3.md`.
3. Defina inicialmente o status como `Proposed` e atualize-o para `Accepted`
   quando a decisão for tomada.
4. Referencie o ADR na documentação de arquitetura quando ele ajudar a explicar
   um componente, uma restrição ou uma consequência visível.

Os identificadores não são reutilizados, mesmo se uma proposta for abandonada.

## Status e ciclo de vida

- `Proposed`: decisão ainda em avaliação.
- `Accepted`: decisão adotada e vigente.
- `Deprecated`: decisão que não deve orientar novas mudanças, sem substituta
  específica.
- `Superseded`: decisão substituída por outro ADR; informe qual ADR a
  substituiu.

ADRs são registros históricos. Não remova nem reescreva uma decisão aceita
para refletir uma mudança posterior. Crie um novo ADR e atualize o anterior
para `Superseded` quando houver uma substituição explícita.

## Quando registrar

Crie um ADR para decisões que afetem significativamente a arquitetura,
introduzam uma tecnologia ou dependência estrutural, estabeleçam um padrão
entre componentes, tenham alternativas relevantes, sejam difíceis de reverter
ou precisem preservar o motivo para mudanças futuras. Decisões triviais ou
locais não exigem ADR.

## Decisões registradas

| ADR | Decisão | Status |
| --- | --- | --- |
| [0002](0002-repository-query-builder-boundary.md) | Definir a fronteira entre `Repository` e `QueryBuilder` | Accepted |
| [0004](0004-sql-parametrizado.md) | Usar somente SQL parametrizado | Accepted |
| [0005](0005-no-any-type-driven-api.md) | Manter uma API estrita, sem `any` | Accepted |
| [0006](0006-ritmo-tdd-e-organizacao-dos-testes.md) | Adotar TDD e organizar testes por escopo | Accepted |
| [0007](0007-bun-toolchain.md) | Usar Bun como toolchain do projeto | Accepted |

Os ADRs 0002 e 0004 foram importados de históricos recuperados. Eles preservam
o contexto e as alternativas que continuam necessários para orientar a
fronteira de consultas e a composição SQL atuais.
