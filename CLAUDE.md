# order-of-relations

TypeScript ORM library for PostgreSQL. Uses ECMAScript Stage-3 decorators (no `reflect-metadata`) for entity mapping, a generic `Repository<T>` with a fluent query builder, a DI container, transaction support, and schema-based migrations.

This is both a TCC (undergraduate thesis) project and a publishable npm package.

## Project Structure

```
src/                         ← published library
  core/
    database.ts              PostgreSQL connection pool + transaction helper
    metadata.ts              Entity/column/relation metadata storage
    container.ts             DI singleton container
    repository.ts            Generic Repository<T> with find() / save()
  decorators/
    entity.ts                @Entity
    column.ts                @Column, @PrimaryColumn
    relation.ts              @ManyToOne, @OneToMany
    service.ts               @Service, @Inject, @InjectRepository
  query-builder/
    types.ts                 WhereClause, OrderByClause interfaces
    query-builder.ts         Fluent QueryBuilder<T>
  migrations/
    types.ts                 ColumnType enum
    schema-generator.ts      Generate CREATE TABLE SQL from entity metadata
    migration-runner.ts      Run schema sync against live database
  transaction/
    transaction-manager.ts   Database.transaction() helper (lives in core)
  index.ts                   Public API barrel export
examples/
  basic-crud/
    entities/User.ts
    services/UserService.ts
    index.ts
```

## Bun commands usage

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Testing

Use `bun test` to run tests. Tests live next to their source files (e.g., `src/query-builder/query-builder.test.ts`).

```ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Key Architecture Decisions

- **Decorator metadata**: ECMAScript Stage-3 decorators with a custom `metadataStorage` Map. No `reflect-metadata` dependency.
- **DI container**: `Container` holds singletons. `@Service` wraps constructor to inject `@Inject` / `@InjectRepository` fields.
- **Query builder**: `Repository.find()` returns a `QueryBuilder<T>` that accumulates clauses and executes lazily on `getMany()` / `getOne()`.

## Column Type Mapping (`@Column({ type })`)

| TypeScript intent | `type` value |
|---|---|
| auto-increment PK | `'serial'` (default for `@PrimaryColumn`) |
| integer | `'integer'` |
| text | `'text'` (default for `@Column`) |
| boolean | `'boolean'` |
| timestamp | `'timestamp'` |
