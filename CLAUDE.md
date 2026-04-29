# order-of-relations

TypeScript ORM library for PostgreSQL. Uses ECMAScript Stage-3 decorators (no `reflect-metadata` dependency) for entity mapping.
This is both a TCC (undergraduate thesis) project and a publishable npm package.

**For project context in 30 seconds, read `docs/vault/OOR/wiki/brief.md`.** It covers architecture, hard rules, method shapes, and open questions, with wikilinks for depth.

## Bun commands usage

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Testing

This project follows **TDD (Test-Driven Development)**. When implementing new features or fixing bugs:

1. **Write a failing test first** that describes the expected behavior.
2. **Write the minimal code** to make the test pass.
3. **Refactor** while keeping all tests green.

Use `bun test` to run tests. Tests live next to their source files (e.g., `src/query-builder/query-builder.test.ts`).

```ts
import { test, expect } from 'bun:test';

test('hello world', () => {
  expect(1).toBe(1);
});
```

## Linting

Uses ESLint with the recommended configuration (`@eslint/js` recommended + `typescript-eslint` recommended). Run with:

```bash
bunx eslint .
```

**Critical rule — `@typescript-eslint/no-explicit-any`**: The use of `any` is **forbidden**. Always use proper types, generics, or `unknown` instead. This is strictly enforced and must never be suppressed with `// eslint-disable` comments without a very strong justification.

**Critical rule — `sql.unsafe`**: Never use `sql.unsafe` anywhere in this repository. All SQL must go through parameterized queries to prevent SQL injection. Use the query builder or parameterized `sql` tagged template literals instead.

## Wiki Knowledge Base

The OOR design wiki lives at `docs/vault/OOR/wiki/` (symlink to the wiki repo).

Read it when you need: the _why_ behind an architectural choice, cross-component
flows, entity models, or historical decisions. Do NOT read it for syntax,
file-finding, or general coding tasks.

Read in this order, stopping as soon as you have enough:

1. `docs/vault/OOR/wiki/brief.md` — 30-second project overview (start here on a fresh session).
2. `docs/vault/OOR/wiki/hot.md` — what changed recently.
3. `docs/vault/OOR/wiki/index.md` — full index.
4. `docs/vault/OOR/wiki/<section>/index.md` where `<section>` is one of `domains`, `concepts`, `decisions`, `flows`, `entities`.
5. The specific page from the sub-index.

Do not modify wiki files unless explicitly asked.
