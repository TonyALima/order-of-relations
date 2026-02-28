# order-of-relations — Initial Structure Design

**Date:** 2026-02-27
**Status:** Approved

## Overview

`order-of-relations` is a TypeScript ORM library for PostgreSQL, built with decorator-based entity mapping, a generic repository pattern, dependency injection, and a fluent query builder. It is both a TCC (undergraduate thesis) project and a publishable npm/bun package.

---

## Goals

- Decorator-based entity definition (`@Entity`, `@Column`, `@ManyToOne`, etc.)
- Generic `Repository<T>` with fluent query builder (`.find().where().orderBy().limit().getMany()`)
- Schema migrations generated from entity metadata
- Transaction support
- Publishable as `order-of-relations` on npm/jsr
- Bun as runtime and build tool; `pg` as the only database driver (PostgreSQL only)

---

## Directory Structure

```
order-of-relations/
├── src/                            ← published library source
│   ├── core/
│   │   ├── database.ts             connection pool (existing)
│   │   ├── metadata.ts             metadata storage + interfaces (existing)
│   │   ├── container.ts            DI container (existing)
│   │   └── repository.ts           generic repository (existing)
│   ├── decorators/
│   │   ├── entity.ts               @Entity decorator
│   │   ├── column.ts               @Column, @PrimaryColumn
│   │   ├── relation.ts             @ManyToOne, @OneToMany
│   │   └── service.ts              @Service, @Inject, @InjectRepository
│   ├── query-builder/
│   │   ├── query-builder.ts        fluent query API
│   │   └── types.ts                WhereClause, OrderByClause interfaces
│   ├── migrations/
│   │   ├── migration-runner.ts     run/rollback/sync migrations
│   │   ├── schema-generator.ts     generate SQL DDL from entity metadata
│   │   └── types.ts                Migration interface
│   ├── transaction/
│   │   └── transaction-manager.ts  wrap operations in a pg transaction
│   └── index.ts                    public API barrel export
├── examples/
│   └── basic-crud/                 TCC demo (User entity, UserService, index.ts)
├── docs/
│   └── plans/
│       └── 2026-02-27-initial-structure-design.md
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

---

## Public API (`src/index.ts`)

```ts
// Decorators
export { Entity } from './decorators/entity'
export { Column, PrimaryColumn } from './decorators/column'
export { ManyToOne, OneToMany } from './decorators/relation'
export { Service, Inject, InjectRepository } from './decorators/service'

// Core
export { Database } from './core/database'
export { Repository } from './core/repository'
export { Container } from './core/container'

// Query Builder
export type { QueryBuilder } from './query-builder/query-builder'

// Migrations
export { MigrationRunner } from './migrations/migration-runner'
export { SchemaGenerator } from './migrations/schema-generator'

// Transactions
export { TransactionManager } from './transaction/transaction-manager'

// Types
export type { EntityMetadata, ColumnMetadata, RelationMetadata } from './core/metadata'
```

---

## Feature APIs

### Query Builder

Accessed via `repository.find()`, returns a fluent `QueryBuilder<T>`:

```ts
const users = await repo.find()
  .where({ name: 'Maria' })
  .orderBy('created_at', 'DESC')
  .limit(10)
  .getMany()

const user = await repo.find()
  .where({ id: 1 })
  .getOne()
```

### Transactions

```ts
await Database.transaction(async (trx) => {
  await userRepo.save(user, trx)
  await postRepo.save(post, trx)
})
```

### Migrations

```ts
// Sync schema from entities (create/alter tables)
const runner = new MigrationRunner([User, Post])
await runner.sync()

// Or generate the SQL without applying it
const generator = new SchemaGenerator([User, Post])
const sql = generator.generateCreateTable()
```

---

## Architecture Decisions

1. **Decorator metadata**: Uses ECMAScript Stage 3 decorators with a custom `metadataStorage` Map, avoiding `reflect-metadata` as a dependency.
2. **DI container**: Singleton-per-class container; services declare dependencies via `@Inject` / `@InjectRepository`.
3. **Query builder pattern**: `Repository.find()` returns a builder object that accumulates clauses and executes lazily on `getMany()` / `getOne()`.
4. **Migrations via schema introspection**: `SchemaGenerator` reads `metadataStorage` at runtime to produce DDL, enabling `runner.sync()` as a zero-config migration path.
5. **Transactions via pg client**: `TransactionManager` acquires a single `pg.PoolClient`, issues `BEGIN/COMMIT/ROLLBACK`, and passes the client down to repositories.

---

## package.json Changes

- Rename `name` from `tony-orm` → `order-of-relations`
- Add `exports` field: `{ ".": "./src/index.ts" }`
- Add scripts: `"test": "bun test"`, `"build": "bun build src/index.ts --outdir dist"`

---

## CLAUDE.md Additions

- Project identity and purpose
- Module map (where each feature lives)
- Key architecture decisions
- Testing conventions
