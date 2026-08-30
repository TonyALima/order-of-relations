# ADR 0007 — Bun como toolchain único

- **Status:** aceita
- **Data:** 2026-04-29
- **Decisor:** Tony Albert

## Contexto

A toolchain de um ORM pequeno facilmente termina com cinco componentes: um runtime (`node`), um
executor de TypeScript (`ts-node`/`tsx`), um gerenciador de pacotes (`npm`/`pnpm`), um test
runner (`jest`/`vitest`) e um bundler (`webpack`/`tsup`/`rollup`). Cada um tem configuração
própria, drift de versão e edge cases.

Desde a versão 1.x, o Bun entrega os cinco em um único binário com defaults zero-config:
TypeScript nativo, test runner embutido, `bun install`, carregamento nativo de `.env` e
`bun build`.

## Decisão

**Bun é o único toolchain.** O OOR usa `bun test`, `bun install`, `bun build` e execução direta
com `bun ./script.ts`. Sem `node`, sem `ts-node`, sem `npm`/`pnpm`, sem `jest`, sem
`webpack`/`tsup`.

## Consequências

### Positivas

- Um binário, um install. Contribuidores novos rodam `bun install` e o projeto funciona de ponta
  a ponta.
- TypeScript nativo: sem plumbing de `tsconfig.json` para execução (o `tsconfig.json` continua
  sendo a fonte da verdade para estricção, mas o Bun o lê diretamente).
- Velocidade: `bun install` e `bun test` são visivelmente mais rápidos que os equivalentes
  npm/jest.
- Fonte única de verdade para carregamento de `.env`.
- O driver `SQL` do Bun é o que alimenta o acesso a PostgreSQL do OOR — a escolha de toolchain e
  a de runtime se reforçam mutuamente.

### Negativas / trade-offs

- O Bun é mais jovem que o ecossistema Node. Incompatibilidades de edge case existem e aparecem
  raramente, mas de forma disruptiva.
- Algumas bibliotecas assumem `node` e tropeçam nas APIs do Bun. A maioria vem fechando essas
  lacunas com o tempo, mas o risco não é zero.
- Um consumidor do OOR não *precisa* usar Bun (o pacote npm publicado é portável) — mas
  contribuidores precisam.

### Neutras

- A escolha de toolchain é parcialmente acoplada à ADR 0006 (TDD): `bun test` é o que torna o
  loop de teste rápido o bastante para virar hábito.
- E ao uso do driver `SQL` nativo do Bun para PostgreSQL — a espinha dorsal de runtime da
  execução do Repository.

## Alternativas consideradas

- **Node + tsx + pnpm + vitest** — rejeitada: quatro binários, quatro configs, nenhum ganho real
  sobre o Bun na escala deste projeto.
- **Deno** — rejeitada: ainda mais divergente das convenções npm; complicaria a publicação no
  npm.

## Referências

- [ADR 0006 — TDD como ritmo de implementação](0006-tdd-rhythm.md)
