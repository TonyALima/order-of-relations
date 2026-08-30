# ADR 0004 — Somente SQL parametrizado; nenhum `sql.unsafe` em lugar algum

- **Status:** aceita
- **Data:** 2026-04-29
- **Decisor:** Tony Albert

## Contexto

O driver `SQL` do Bun expõe uma API de tagged template `` sql`...` `` para queries parametrizadas
e uma escotilha `sql.unsafe(text)` para interpolação crua de strings. A escotilha é conveniente,
mas é o vetor canônico de SQL injection.

A maioria dos ORMs permite `unsafe` sob a justificativa de que "o usuário sabe o que está
fazendo". Empiricamente, é assim que bugs de injeção vão para produção.

## Decisão

**`sql.unsafe` é banido sumariamente do código do OOR.** Toda query — produzida por método de
repositório, pelo query builder ou por uma migration — passa por templates parametrizados. SQL
injection é tratado como uma propriedade de corretude inegociável da biblioteca.

## Consequências

### Positivas

- Uma classe inteira de vulnerabilidades é removida da superfície da biblioteca por construção.
- Zero custo cognitivo em code review sobre se uma interpolação é segura.
- Alinha-se com a postura de tipagem estrita (ver
  [ADR 0005](0005-no-any-type-driven-api.md)) — ambas as decisões empurram erros para tempo de
  compilação / lint em vez de runtime.

### Negativas / trade-offs

- Alguns padrões naturais exigem contornos. Identificadores dinâmicos (nomes de tabela e coluna)
  não podem ser parametrizados em SQL padrão — precisam passar por uma allowlist ou helper de
  quoting, nunca por interpolação crua.
- O query builder precisa ser expressivo o bastante para cobrir os casos compostos que um
  contribuidor preguiçoso poderia tentar resolver com `unsafe`.

### Neutras

- A regra é aplicada por lint, code review e convenção. Não há mecanismo sintático que proíba o
  import — a disciplina é a enforcement.

## Alternativas consideradas

- **Permitir `sql.unsafe` com exigência de comentário explicativo** — rejeitada: anotações
  decaem; o próximo mantenedor copia o padrão sem o aviso.
- **Fornecer um helper de "input confiável" que embrulha `unsafe`** — rejeitada: o mesmo problema
  com uma camada a mais de indireção.

## Referências

- [Conceito: Parameterized SQL](../concepts/parameterized-sql.md)
