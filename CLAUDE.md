# order-of-relations

TypeScript ORM library for PostgreSQL. Uses ECMAScript Stage-3 decorators (no `reflect-metadata`) for entity mapping, a generic `Repository<T>` with a fluent query builder, a DI container, transaction support, and schema-based migrations.

This is both a TCC (undergraduate thesis) project and a publishable npm package.

## Project Structure

```text
src/                                  ← published library
  core/
    container/
      container.ts                    DI singleton container
    database/
      database.ts                     Database connection + schema create/drop
      database.errors.ts              Database-specific errors
      database.test.ts
    metadata/
      metadata.ts                     Entity/column/relation metadata storage
      metadata.errors.ts              Metadata-specific errors
      metadata.test.ts
    orm-error/
      index.ts                        Base OrmError class
    repository/
      repository.ts                   Generic Repository<T>
      repository.test.ts
    sql-types/
      sql-types.ts                    SQL column types + definitions
      sql-types.errors.ts             SQL type-related errors
      sql-types.test.ts
    utils/
      utils.ts
  decorators/
    column/
      column.ts                       @Column, @PrimaryColumn
    entity/
      entity.ts                       @Entity
      entity.errors.ts                Entity decorator errors
      entity.test.ts
    relation/
      relation.ts                     @ToOne
      relation.test.ts
    service/
      service.ts                      @Service, @Inject, @InjectRepository
  query-builder/
    query-builder.ts                  Fluent QueryBuilder<T>
    query-builder.errors.ts           Query builder errors
    query-builder.test.ts
    types.ts                          Condition/FindOptions interfaces
  errors.ts                           Public error exports
  index.ts                            Public API barrel export
  index.test.ts
examples/
  basic-crud/
    entities/User.ts
    services/UserService.ts
    index.ts
  inheritance/
    entities/User.ts
    entities/AdminUser.ts
    services/UserHierarchyService.ts
    index.ts
  relations/
    services/
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

## Key Architecture Decisions

- **Decorator metadata**: ECMAScript Stage-3 decorators with a custom `metadataStorage` Map. No `reflect-metadata` dependency.
- **DI container**: `Container` holds singletons. `@Service` wraps constructor to inject `@Inject` / `@InjectRepository` fields.
- **Query builder**: `Repository.find()` returns a `QueryBuilder<T>` that accumulates clauses and executes lazily on `getMany()` / `getOne()`.

## Column Type Mapping (`@Column({ type })`)

| TypeScript intent | `type` value                              |
| ----------------- | ----------------------------------------- |
| auto-increment PK | `'serial'` (default for `@PrimaryColumn`) |
| integer           | `'integer'`                               |
| text              | `'text'` (default for `@Column`)          |
| boolean           | `'boolean'`                               |
| timestamp         | `'timestamp'`                             |
