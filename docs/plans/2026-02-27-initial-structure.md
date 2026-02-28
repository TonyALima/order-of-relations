# order-of-relations Initial Structure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the repo into a publishable TypeScript ORM library (`order-of-relations`) with a query builder, transaction support, schema migrations, and a clean examples folder.

**Architecture:** Single `src/` package with barrel export at `src/index.ts`. Decorators split into a dedicated `src/decorators/` folder. New features (`query-builder/`, `migrations/`, `transaction/`) added as sibling modules. Demo code moved to `examples/basic-crud/`.

**Tech Stack:** TypeScript 5, Bun runtime, `pg` (PostgreSQL), ECMAScript Stage-3 decorators (no `reflect-metadata`), `bun:test` for tests.

---

## Task 1: Update `package.json` and `CLAUDE.md`

**Files:**
- Modify: `package.json`
- Modify: `CLAUDE.md`

### Step 1: Update package.json

Replace the contents of `package.json`:

```json
{
  "name": "order-of-relations",
  "version": "0.1.0",
  "module": "src/index.ts",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "build": "bun build src/index.ts --outdir dist"
  },
  "devDependencies": {
    "@types/bun": "^1.3.9",
    "@types/pg": "^8.16.0"
  },
  "peerDependencies": {
    "typescript": "^5"
  },
  "dependencies": {
    "pg": "^8.19.0"
  }
}
```

### Step 2: Update CLAUDE.md

Replace the contents of `CLAUDE.md`:

````markdown
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
- **Transactions**: `Database.transaction(async (trx) => { ... })` acquires a pool client, wraps in `BEGIN/COMMIT/ROLLBACK`, and passes the client to repository methods.
- **Migrations**: `SchemaGenerator` reads `metadataStorage` at runtime to produce DDL. `MigrationRunner.sync()` applies it.

## Column Type Mapping (`@Column({ type })`)

| TypeScript intent | `type` value |
|---|---|
| auto-increment PK | `'serial'` (default for `@PrimaryColumn`) |
| integer | `'integer'` |
| text | `'text'` (default for `@Column`) |
| boolean | `'boolean'` |
| timestamp | `'timestamp'` |
````

### Step 3: Commit

```bash
git add package.json CLAUDE.md
git commit -m "chore: rename to order-of-relations, update CLAUDE.md with project structure"
```

---

## Task 2: Split decorators into `src/decorators/`

**Files:**
- Create: `src/decorators/entity.ts`
- Create: `src/decorators/column.ts`
- Create: `src/decorators/relation.ts`
- Create: `src/decorators/service.ts`
- Delete: `src/core/decorators.ts`
- Delete: `src/core/service-decorators.ts`

### Step 1: Create `src/decorators/entity.ts`

```ts
import { metadataStorage } from "../core/metadata"

const COLUMNS_KEY = Symbol("columns")
const RELATIONS_KEY = Symbol("relations")

// Polyfill Symbol.metadata if not available
;(Symbol as any).metadata ??= Symbol("Symbol.metadata")

export { COLUMNS_KEY, RELATIONS_KEY }

export function Entity(tableName: string) {
  return function <T extends abstract new (...args: any[]) => any>(
    value: T,
    context: ClassDecoratorContext<T>
  ) {
    const columns = (context.metadata[COLUMNS_KEY] as any[]) ?? []
    const relations = (context.metadata[RELATIONS_KEY] as any[]) ?? []
    metadataStorage.set(value, { tableName, columns, relations })
  }
}
```

### Step 2: Create `src/decorators/column.ts`

Note: `@Column` now accepts an optional `options` object with `name` (column alias) and `type` (PostgreSQL type string, e.g. `'text'`, `'integer'`, `'boolean'`, `'timestamp'`). Default type is `'text'`. `@PrimaryColumn` defaults to `'serial'`.

```ts
import type { ColumnMetadata } from "../core/metadata"
import { COLUMNS_KEY } from "./entity"

export function Column(options?: { name?: string; type?: string }) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= [])
    columns.push({
      propertyName: String(context.name),
      columnName: options?.name ?? String(context.name),
      type: options?.type ?? "text",
    })
  }
}

export function PrimaryColumn(options?: { name?: string; type?: string }) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= [])
    columns.push({
      propertyName: String(context.name),
      columnName: options?.name ?? String(context.name),
      type: options?.type ?? "serial",
      primary: true,
    })
  }
}
```

### Step 3: Create `src/decorators/relation.ts`

```ts
import type { RelationMetadata } from "../core/metadata"
import { RELATIONS_KEY } from "./entity"

export function ManyToOne(target: Function) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations: RelationMetadata[] = ((context.metadata[RELATIONS_KEY] as RelationMetadata[]) ??= [])
    relations.push({
      propertyName: String(context.name),
      type: "many-to-one",
      target,
    })
  }
}

export function OneToMany(target: Function, inverseSide: string) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations: RelationMetadata[] = ((context.metadata[RELATIONS_KEY] as RelationMetadata[]) ??= [])
    relations.push({
      propertyName: String(context.name),
      type: "one-to-many",
      target,
      inverseSide,
    })
  }
}
```

### Step 4: Create `src/decorators/service.ts`

Move the full content of `src/core/service-decorators.ts` here, updating the imports:

```ts
import { Container } from "../core/container"
import { Repository } from "../core/repository"

const INJECTIONS_KEY = Symbol("injections")

interface InjectionMetadata {
  propertyKey: string
  type: any
  repositoryEntity?: any
}

;(Symbol as any).metadata ??= Symbol("Symbol.metadata")

function getInjections(metadata: DecoratorMetadataObject): InjectionMetadata[] {
  return ((metadata[INJECTIONS_KEY] as InjectionMetadata[]) ??= [])
}

export function Service() {
  return function <T extends new (...args: any[]) => any>(
    value: T,
    context: ClassDecoratorContext<T>
  ) {
    const injections = getInjections(context.metadata)

    return class extends value {
      constructor(...args: any[]) {
        super(...args)

        for (const injection of injections) {
          if (injection.repositoryEntity) {
            ;(this as any)[injection.propertyKey] = new Repository(injection.repositoryEntity)
          } else {
            ;(this as any)[injection.propertyKey] = Container.resolve(injection.type)
          }
        }

        Container.register(this.constructor, this)
      }
    }
  }
}

export function Inject(type: new (...args: any[]) => any) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const injections = getInjections(context.metadata)
    injections.push({ propertyKey: String(context.name), type })
  }
}

export function InjectRepository(entity: any) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const injections = getInjections(context.metadata)
    injections.push({
      propertyKey: String(context.name),
      type: Repository,
      repositoryEntity: entity,
    })
  }
}
```

### Step 5: Update `src/core/metadata.ts`

Add the `type` field to `ColumnMetadata`:

```ts
export interface ColumnMetadata {
  propertyName: string
  columnName: string
  type?: string
  primary?: boolean
}

export interface RelationMetadata {
  propertyName: string
  type: "many-to-one" | "one-to-many"
  target: Function
  inverseSide?: string
}

export interface EntityMetadata {
  tableName: string
  columns: ColumnMetadata[]
  relations: RelationMetadata[]
}

export const metadataStorage = new Map<Function, EntityMetadata>()
```

### Step 6: Delete old files

```bash
rm src/core/decorators.ts
rm src/core/service-decorators.ts
```

### Step 7: Commit

```bash
git add src/decorators/ src/core/metadata.ts
git rm src/core/decorators.ts src/core/service-decorators.ts
git commit -m "refactor: split decorators into src/decorators/ module, add type field to ColumnMetadata"
```

---

## Task 3: Move example code to `examples/basic-crud/`

**Files:**
- Create: `examples/basic-crud/entities/User.ts`
- Create: `examples/basic-crud/services/UserService.ts`
- Create: `examples/basic-crud/index.ts`
- Delete: `src/entities/User.ts`
- Delete: `src/services/UserService.ts`
- Delete: `index.ts` (root)

### Step 1: Create `examples/basic-crud/entities/User.ts`

```ts
import { Entity, Column, PrimaryColumn } from "../../../src/decorators/entity"
import { Column as ColumnDec } from "../../../src/decorators/column"

// Note: once src/index.ts exists, change this to:
// import { Entity, Column, PrimaryColumn } from "../../../src"
import { Entity as EntityDec } from "../../../src/decorators/entity"
import { PrimaryColumn as PrimaryColumnDec } from "../../../src/decorators/column"
```

Actually, wait — `examples/` will import from the library barrel once `src/index.ts` is created in Task 4. For now, use direct paths. The example will be updated in Task 4.

Create `examples/basic-crud/entities/User.ts`:

```ts
import { Entity } from "../../../src/decorators/entity"
import { Column, PrimaryColumn } from "../../../src/decorators/column"

@Entity("user")
export class User {
  @PrimaryColumn()
  id!: number

  @Column()
  name!: string

  @Column()
  email!: string
}
```

### Step 2: Create `examples/basic-crud/services/UserService.ts`

```ts
import { Service, InjectRepository } from "../../../src/decorators/service"
import { Repository } from "../../../src/core/repository"
import { User } from "../entities/User"

@Service()
export class UserService {
  @InjectRepository(User)
  private userRepository!: Repository<User>

  async createUser(name: string, email: string) {
    await this.userRepository.save({ name, email })
  }

  async listUsers() {
    return this.userRepository.findAll()
  }
}
```

### Step 3: Create `examples/basic-crud/index.ts`

```ts
import { Database } from "../../src/core/database"
import { Container } from "../../src/core/container"
import { UserService } from "./services/UserService"

async function main() {
  Database.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? "5432"),
  })

  const userService = Container.resolve(UserService)

  await userService.createUser("Maria", "maria@email.com")

  const users = await userService.listUsers()
  console.log(users)
}

main()
```

### Step 4: Delete old files

```bash
rm src/entities/User.ts
rmdir src/entities
rm src/services/UserService.ts
rmdir src/services
rm index.ts
```

### Step 5: Commit

```bash
git add examples/
git rm -r src/entities/ src/services/ index.ts
git commit -m "refactor: move example code to examples/basic-crud/"
```

---

## Task 4: Create `src/index.ts` barrel export

**Files:**
- Create: `src/index.ts`
- Modify: `examples/basic-crud/entities/User.ts`
- Modify: `examples/basic-crud/services/UserService.ts`
- Modify: `examples/basic-crud/index.ts`

### Step 1: Write a smoke test

Create `src/index.test.ts`:

```ts
import { test, expect } from "bun:test"
import {
  Entity, Column, PrimaryColumn, ManyToOne, OneToMany,
  Service, Inject, InjectRepository,
  Database, Repository, Container,
} from "./index"

test("all core exports are defined", () => {
  expect(Entity).toBeFunction()
  expect(Column).toBeFunction()
  expect(PrimaryColumn).toBeFunction()
  expect(ManyToOne).toBeFunction()
  expect(OneToMany).toBeFunction()
  expect(Service).toBeFunction()
  expect(Inject).toBeFunction()
  expect(InjectRepository).toBeFunction()
  expect(Database).toBeDefined()
  expect(Repository).toBeFunction()
  expect(Container).toBeDefined()
})
```

### Step 2: Run test — expect it to fail

```bash
bun test src/index.test.ts
```

Expected: `Cannot find module './index'`

### Step 3: Create `src/index.ts`

```ts
// Decorators
export { Entity } from "./decorators/entity"
export { Column, PrimaryColumn } from "./decorators/column"
export { ManyToOne, OneToMany } from "./decorators/relation"
export { Service, Inject, InjectRepository } from "./decorators/service"

// Core
export { Database } from "./core/database"
export { Repository } from "./core/repository"
export { Container } from "./core/container"

// Types
export type { EntityMetadata, ColumnMetadata, RelationMetadata } from "./core/metadata"
```

### Step 4: Run test — expect it to pass

```bash
bun test src/index.test.ts
```

Expected: all tests pass.

### Step 5: Update example imports to use the barrel

Update `examples/basic-crud/entities/User.ts`:

```ts
import { Entity, Column, PrimaryColumn } from "../../../src"
```

Update `examples/basic-crud/services/UserService.ts`:

```ts
import { Service, InjectRepository, Repository } from "../../../src"
import { User } from "../entities/User"

@Service()
export class UserService {
  @InjectRepository(User)
  private userRepository!: Repository<User>

  async createUser(name: string, email: string) {
    await this.userRepository.save({ name, email })
  }

  async listUsers() {
    return this.userRepository.findAll()
  }
}
```

Update `examples/basic-crud/index.ts`:

```ts
import { Database, Container } from "../../../src"
import { UserService } from "./services/UserService"

async function main() {
  Database.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? "5432"),
  })

  const userService = Container.resolve(UserService)
  await userService.createUser("Maria", "maria@email.com")
  const users = await userService.listUsers()
  console.log(users)
}

main()
```

### Step 6: Run all tests

```bash
bun test
```

Expected: all tests pass.

### Step 7: Commit

```bash
git add src/index.ts src/index.test.ts examples/
git commit -m "feat: add public API barrel export (src/index.ts)"
```

---

## Task 5: Query Builder

**Files:**
- Create: `src/query-builder/types.ts`
- Create: `src/query-builder/query-builder.ts`
- Create: `src/query-builder/query-builder.test.ts`
- Modify: `src/core/repository.ts`
- Modify: `src/index.ts`

### Step 1: Write failing tests

Create `src/query-builder/query-builder.test.ts`:

```ts
import { test, expect, beforeEach, spyOn, mock } from "bun:test"
import { Database } from "../core/database"
import { QueryBuilder } from "./query-builder"
import { metadataStorage } from "../core/metadata"

// Set up a mock entity
class MockUser {}
metadataStorage.set(MockUser, {
  tableName: "user",
  columns: [
    { propertyName: "id", columnName: "id", type: "serial", primary: true },
    { propertyName: "name", columnName: "name", type: "text" },
    { propertyName: "email", columnName: "email", type: "text" },
  ],
  relations: [],
})

beforeEach(() => {
  spyOn(Database, "query").mockResolvedValue({ rows: [] } as any)
})

test("toSQL() generates SELECT * with no clauses", () => {
  const qb = new QueryBuilder(MockUser)
  expect(qb.toSQL()).toBe(`SELECT * FROM "user"`)
})

test("where() adds a WHERE clause with correct placeholder", () => {
  const qb = new QueryBuilder(MockUser).where({ name: "Maria" })
  expect(qb.toSQL()).toBe(`SELECT * FROM "user" WHERE "name" = $1`)
  expect(qb.getParams()).toEqual(["Maria"])
})

test("multiple where() calls are ANDed", () => {
  const qb = new QueryBuilder(MockUser).where({ name: "Maria" }).where({ email: "m@email.com" })
  expect(qb.toSQL()).toBe(`SELECT * FROM "user" WHERE "name" = $1 AND "email" = $2`)
  expect(qb.getParams()).toEqual(["Maria", "m@email.com"])
})

test("orderBy() appends ORDER BY clause", () => {
  const qb = new QueryBuilder(MockUser).orderBy("name", "DESC")
  expect(qb.toSQL()).toBe(`SELECT * FROM "user" ORDER BY "name" DESC`)
})

test("limit() appends LIMIT clause", () => {
  const qb = new QueryBuilder(MockUser).limit(5)
  expect(qb.toSQL()).toBe(`SELECT * FROM "user" LIMIT 5`)
})

test("offset() appends OFFSET clause", () => {
  const qb = new QueryBuilder(MockUser).offset(10)
  expect(qb.toSQL()).toBe(`SELECT * FROM "user" OFFSET 10`)
})

test("combined clauses build full SQL", () => {
  const qb = new QueryBuilder(MockUser)
    .where({ name: "Maria" })
    .orderBy("name", "ASC")
    .limit(10)
    .offset(0)
  expect(qb.toSQL()).toBe(
    `SELECT * FROM "user" WHERE "name" = $1 ORDER BY "name" ASC LIMIT 10 OFFSET 0`
  )
})

test("getMany() calls Database.query with correct SQL and params", async () => {
  spyOn(Database, "query").mockResolvedValue({ rows: [{ id: 1, name: "Maria" }] } as any)
  const qb = new QueryBuilder(MockUser).where({ name: "Maria" })
  const result = await qb.getMany()
  expect(Database.query).toHaveBeenCalledWith(
    `SELECT * FROM "user" WHERE "name" = $1`,
    ["Maria"]
  )
  expect(result).toEqual([{ id: 1, name: "Maria" }])
})

test("getOne() appends LIMIT 1 and returns first row", async () => {
  spyOn(Database, "query").mockResolvedValue({ rows: [{ id: 1, name: "Maria" }] } as any)
  const result = await new QueryBuilder(MockUser).where({ id: 1 }).getOne()
  expect(result).toEqual({ id: 1, name: "Maria" })
})

test("getOne() returns null when no rows", async () => {
  spyOn(Database, "query").mockResolvedValue({ rows: [] } as any)
  const result = await new QueryBuilder(MockUser).getOne()
  expect(result).toBeNull()
})
```

### Step 2: Run tests — expect them to fail

```bash
bun test src/query-builder/query-builder.test.ts
```

Expected: `Cannot find module './query-builder'`

### Step 3: Create `src/query-builder/types.ts`

```ts
export interface OrderByClause {
  column: string
  direction: "ASC" | "DESC"
}

export interface WhereClause {
  column: string
  value: unknown
}
```

### Step 4: Create `src/query-builder/query-builder.ts`

```ts
import { Database } from "../core/database"
import { metadataStorage } from "../core/metadata"
import type { WhereClause, OrderByClause } from "./types"

export class QueryBuilder<T = any> {
  private readonly tableName: string
  private whereClauses: WhereClause[] = []
  private orderByClauses: OrderByClause[] = []
  private limitValue?: number
  private offsetValue?: number

  constructor(private entity: Function) {
    const meta = metadataStorage.get(entity)
    if (!meta) throw new Error(`Entity ${entity.name} is not registered. Did you use @Entity?`)
    this.tableName = meta.tableName
  }

  private quote(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  where(conditions: Partial<Record<string, unknown>>): this {
    for (const [column, value] of Object.entries(conditions)) {
      this.whereClauses.push({ column, value })
    }
    return this
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByClauses.push({ column, direction })
    return this
  }

  limit(n: number): this {
    this.limitValue = n
    return this
  }

  offset(n: number): this {
    this.offsetValue = n
    return this
  }

  getParams(): unknown[] {
    return this.whereClauses.map(c => c.value)
  }

  toSQL(): string {
    const parts: string[] = [`SELECT * FROM ${this.quote(this.tableName)}`]

    if (this.whereClauses.length > 0) {
      const conditions = this.whereClauses.map(
        (c, i) => `${this.quote(c.column)} = $${i + 1}`
      )
      parts.push(`WHERE ${conditions.join(" AND ")}`)
    }

    if (this.orderByClauses.length > 0) {
      const orders = this.orderByClauses.map(
        o => `${this.quote(o.column)} ${o.direction}`
      )
      parts.push(`ORDER BY ${orders.join(", ")}`)
    }

    if (this.limitValue !== undefined) {
      parts.push(`LIMIT ${this.limitValue}`)
    }

    if (this.offsetValue !== undefined) {
      parts.push(`OFFSET ${this.offsetValue}`)
    }

    return parts.join(" ")
  }

  async getMany(): Promise<T[]> {
    const result = await Database.query(this.toSQL(), this.getParams() as any[])
    return result.rows as T[]
  }

  async getOne(): Promise<T | null> {
    this.limitValue = 1
    const result = await Database.query(this.toSQL(), this.getParams() as any[])
    return (result.rows[0] as T) ?? null
  }
}
```

### Step 5: Run tests — expect them to pass

```bash
bun test src/query-builder/query-builder.test.ts
```

Expected: all 11 tests pass.

### Step 6: Add `find()` to `Repository`

Update `src/core/repository.ts` to add the `find()` method:

```ts
import { metadataStorage } from "./metadata"
import { Database } from "./database"
import { QueryBuilder } from "../query-builder/query-builder"

export class Repository<T> {
  constructor(private entity: new () => T) {}

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  find(): QueryBuilder<T> {
    return new QueryBuilder<T>(this.entity)
  }

  async findAll(): Promise<T[]> {
    const meta = metadataStorage.get(this.entity)!
    const tableName = this.quoteIdentifier(meta.tableName)
    const result = await Database.query(`SELECT * FROM ${tableName}`)
    return result.rows
  }

  async save(entity: Omit<T, "id">) {
    const meta = metadataStorage.get(this.entity)!
    const columns = meta.columns.filter(c => !c.primary)
    const tableName = this.quoteIdentifier(meta.tableName)
    const columnNames = columns.map(c => this.quoteIdentifier(c.columnName))
    const values = columns.map(c => (entity as any)[c.propertyName])
    const placeholders = values.map((_, i) => `$${i + 1}`)

    await Database.query(
      `INSERT INTO ${tableName} (${columnNames.join(",")}) VALUES (${placeholders.join(",")})`,
      values
    )
  }
}
```

### Step 7: Export QueryBuilder from `src/index.ts`

Add to `src/index.ts`:

```ts
export { QueryBuilder } from "./query-builder/query-builder"
export type { WhereClause, OrderByClause } from "./query-builder/types"
```

### Step 8: Run all tests

```bash
bun test
```

Expected: all tests pass.

### Step 9: Commit

```bash
git add src/query-builder/ src/core/repository.ts src/index.ts
git commit -m "feat: add QueryBuilder with where/orderBy/limit/offset/getMany/getOne"
```

---

## Task 6: Transaction Support

**Files:**
- Modify: `src/core/database.ts`
- Modify: `src/core/repository.ts`
- Create: `src/core/database.test.ts`
- Modify: `src/index.ts`

### Step 1: Write failing test

Create `src/core/database.test.ts`:

```ts
import { test, expect, spyOn, mock } from "bun:test"
import { Database } from "./database"
import { Pool, PoolClient } from "pg"

// We don't connect a real pool — we mock pool.connect()
test("transaction commits on success", async () => {
  const mockClient = {
    query: mock(() => Promise.resolve({ rows: [] })),
    release: mock(() => {}),
  } as unknown as PoolClient

  // Inject a mock pool
  ;(Database as any).pool = {
    connect: mock(() => Promise.resolve(mockClient)),
  }

  await Database.transaction(async (trx) => {
    await trx.query("INSERT INTO test VALUES ($1)", ["hello"])
  })

  const calls = (mockClient.query as ReturnType<typeof mock>).mock.calls
  expect(calls[0]![0]).toBe("BEGIN")
  expect(calls[1]![0]).toBe("INSERT INTO test VALUES ($1)")
  expect(calls[2]![0]).toBe("COMMIT")
  expect(mockClient.release).toHaveBeenCalled()
})

test("transaction rolls back on error", async () => {
  const mockClient = {
    query: mock((sql: string) => {
      if (sql === "INSERT INTO fail") return Promise.reject(new Error("DB error"))
      return Promise.resolve({ rows: [] })
    }),
    release: mock(() => {}),
  } as unknown as PoolClient

  ;(Database as any).pool = {
    connect: mock(() => Promise.resolve(mockClient)),
  }

  await expect(
    Database.transaction(async (trx) => {
      await trx.query("INSERT INTO fail")
    })
  ).rejects.toThrow("DB error")

  const calls = (mockClient.query as ReturnType<typeof mock>).mock.calls
  expect(calls[0]![0]).toBe("BEGIN")
  expect(calls[2]![0]).toBe("ROLLBACK")
  expect(mockClient.release).toHaveBeenCalled()
})
```

### Step 2: Run tests — expect them to fail

```bash
bun test src/core/database.test.ts
```

Expected: `Property 'transaction' does not exist on type 'typeof Database'`

### Step 3: Update `src/core/database.ts`

```ts
import { Pool, type PoolClient } from "pg"

export class Database {
  private static pool: Pool

  static connect(config: any) {
    this.pool = new Pool(config)
  }

  static async query(sql: string, params?: any[]) {
    return this.pool.query(sql, params)
  }

  static async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      const result = await fn(client)
      await client.query("COMMIT")
      return result
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  }
}
```

### Step 4: Run tests — expect them to pass

```bash
bun test src/core/database.test.ts
```

Expected: both tests pass.

### Step 5: Update `Repository` to accept optional `PoolClient`

Update `src/core/repository.ts`. The `save()` and `findAll()` methods accept an optional `trx` parameter:

```ts
import { metadataStorage } from "./metadata"
import { Database } from "./database"
import { QueryBuilder } from "../query-builder/query-builder"
import type { PoolClient } from "pg"

export class Repository<T> {
  constructor(private entity: new () => T) {}

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  find(): QueryBuilder<T> {
    return new QueryBuilder<T>(this.entity)
  }

  async findAll(trx?: PoolClient): Promise<T[]> {
    const meta = metadataStorage.get(this.entity)!
    const tableName = this.quoteIdentifier(meta.tableName)
    const executor = trx ?? Database
    const result = await executor.query(`SELECT * FROM ${tableName}`)
    return result.rows
  }

  async save(entity: Omit<T, "id">, trx?: PoolClient): Promise<void> {
    const meta = metadataStorage.get(this.entity)!
    const columns = meta.columns.filter(c => !c.primary)
    const tableName = this.quoteIdentifier(meta.tableName)
    const columnNames = columns.map(c => this.quoteIdentifier(c.columnName))
    const values = columns.map(c => (entity as any)[c.propertyName])
    const placeholders = values.map((_, i) => `$${i + 1}`)
    const executor = trx ?? Database

    await executor.query(
      `INSERT INTO ${tableName} (${columnNames.join(",")}) VALUES (${placeholders.join(",")})`,
      values
    )
  }
}
```

### Step 6: Run all tests

```bash
bun test
```

Expected: all tests pass.

### Step 7: Commit

```bash
git add src/core/database.ts src/core/database.test.ts src/core/repository.ts
git commit -m "feat: add Database.transaction() and optional trx param to Repository methods"
```

---

## Task 7: Schema Generator + Migration Runner

**Files:**
- Create: `src/migrations/types.ts`
- Create: `src/migrations/schema-generator.ts`
- Create: `src/migrations/schema-generator.test.ts`
- Create: `src/migrations/migration-runner.ts`
- Create: `src/migrations/migration-runner.test.ts`
- Modify: `src/index.ts`

### Step 1: Write failing tests for SchemaGenerator

Create `src/migrations/schema-generator.test.ts`:

```ts
import { test, expect, beforeAll } from "bun:test"
import { SchemaGenerator } from "./schema-generator"
import { Entity } from "../decorators/entity"
import { Column, PrimaryColumn } from "../decorators/column"

@Entity("post")
class Post {
  @PrimaryColumn()
  id!: number

  @Column({ type: "text" })
  title!: string

  @Column({ type: "boolean" })
  published!: boolean

  @Column({ type: "timestamp" })
  createdAt!: Date
}

test("generates CREATE TABLE IF NOT EXISTS statement", () => {
  const gen = new SchemaGenerator([Post])
  const sql = gen.generateCreateTable(Post)
  expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "post"`)
})

test("primary column uses serial type by default", () => {
  const gen = new SchemaGenerator([Post])
  const sql = gen.generateCreateTable(Post)
  expect(sql).toContain(`"id" SERIAL PRIMARY KEY`)
})

test("text columns are emitted correctly", () => {
  const gen = new SchemaGenerator([Post])
  const sql = gen.generateCreateTable(Post)
  expect(sql).toContain(`"title" TEXT`)
})

test("boolean column type is emitted correctly", () => {
  const gen = new SchemaGenerator([Post])
  const sql = gen.generateCreateTable(Post)
  expect(sql).toContain(`"published" BOOLEAN`)
})

test("timestamp column type is emitted correctly", () => {
  const gen = new SchemaGenerator([Post])
  const sql = gen.generateCreateTable(Post)
  expect(sql).toContain(`"createdAt" TIMESTAMP`)
})

test("generateAll() returns SQL for every registered entity", () => {
  const gen = new SchemaGenerator([Post])
  const sqls = gen.generateAll()
  expect(sqls).toHaveLength(1)
  expect(sqls[0]).toContain("post")
})
```

### Step 2: Run tests — expect them to fail

```bash
bun test src/migrations/schema-generator.test.ts
```

Expected: `Cannot find module './schema-generator'`

### Step 3: Create `src/migrations/types.ts`

```ts
export const ColumnTypeMap: Record<string, string> = {
  serial: "SERIAL",
  integer: "INTEGER",
  text: "TEXT",
  boolean: "BOOLEAN",
  timestamp: "TIMESTAMP",
  numeric: "NUMERIC",
}
```

### Step 4: Create `src/migrations/schema-generator.ts`

```ts
import { metadataStorage } from "../core/metadata"
import { ColumnTypeMap } from "./types"

export class SchemaGenerator {
  constructor(private entities: Function[]) {}

  private quote(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  generateCreateTable(entity: Function): string {
    const meta = metadataStorage.get(entity)
    if (!meta) throw new Error(`Entity ${entity.name} is not registered. Did you use @Entity?`)

    const columnDefs = meta.columns.map(col => {
      const rawType = col.type ?? "text"
      const sqlType = ColumnTypeMap[rawType] ?? rawType.toUpperCase()
      const isPrimary = col.primary
      const typePart = isPrimary && rawType === "serial" ? "SERIAL PRIMARY KEY" : sqlType
      return `  ${this.quote(col.columnName)} ${typePart}`
    })

    return (
      `CREATE TABLE IF NOT EXISTS ${this.quote(meta.tableName)} (\n` +
      columnDefs.join(",\n") +
      `\n)`
    )
  }

  generateAll(): string[] {
    return this.entities.map(e => this.generateCreateTable(e))
  }
}
```

### Step 5: Run schema-generator tests — expect them to pass

```bash
bun test src/migrations/schema-generator.test.ts
```

Expected: all 6 tests pass.

### Step 6: Write failing tests for MigrationRunner

Create `src/migrations/migration-runner.test.ts`:

```ts
import { test, expect, spyOn, mock } from "bun:test"
import { MigrationRunner } from "./migration-runner"
import { Database } from "../core/database"
import { Entity } from "../decorators/entity"
import { PrimaryColumn } from "../decorators/column"

@Entity("run_test")
class RunTest {
  @PrimaryColumn()
  id!: number
}

test("sync() calls Database.query once per entity with CREATE TABLE SQL", async () => {
  spyOn(Database, "query").mockResolvedValue({ rows: [] } as any)

  const runner = new MigrationRunner([RunTest])
  await runner.sync()

  expect(Database.query).toHaveBeenCalledTimes(1)
  const [sql] = (Database.query as ReturnType<typeof spyOn>).mock.calls[0]!
  expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "run_test"`)
})
```

### Step 7: Run test — expect it to fail

```bash
bun test src/migrations/migration-runner.test.ts
```

Expected: `Cannot find module './migration-runner'`

### Step 8: Create `src/migrations/migration-runner.ts`

```ts
import { Database } from "../core/database"
import { SchemaGenerator } from "./schema-generator"

export class MigrationRunner {
  private generator: SchemaGenerator

  constructor(private entities: Function[]) {
    this.generator = new SchemaGenerator(entities)
  }

  async sync(): Promise<void> {
    const sqls = this.generator.generateAll()
    for (const sql of sqls) {
      await Database.query(sql)
    }
  }
}
```

### Step 9: Run all tests

```bash
bun test
```

Expected: all tests pass.

### Step 10: Add migrations exports to `src/index.ts`

Add to `src/index.ts`:

```ts
export { SchemaGenerator } from "./migrations/schema-generator"
export { MigrationRunner } from "./migrations/migration-runner"
```

### Step 11: Run all tests again

```bash
bun test
```

Expected: all tests still pass.

### Step 12: Commit

```bash
git add src/migrations/ src/index.ts
git commit -m "feat: add SchemaGenerator and MigrationRunner for schema-based migrations"
```

---

## Task 8: Update README.md

**Files:**
- Modify: `README.md`

### Step 1: Replace README content

```markdown
# order-of-relations

A TypeScript ORM for PostgreSQL using ECMAScript Stage-3 decorators.

## Features

- `@Entity`, `@Column`, `@PrimaryColumn`, `@ManyToOne`, `@OneToMany` decorators
- Generic `Repository<T>` with fluent query builder
- Dependency injection (`@Service`, `@Inject`, `@InjectRepository`)
- Transaction support via `Database.transaction()`
- Schema migrations via `MigrationRunner.sync()`

## Install

```bash
bun add order-of-relations
```

## Quick Start

```ts
import {
  Entity, Column, PrimaryColumn,
  Repository, Database, MigrationRunner,
} from "order-of-relations"

@Entity("user")
class User {
  @PrimaryColumn()
  id!: number

  @Column()
  name!: string

  @Column()
  email!: string
}

Database.connect({ /* pg config */ })

// Create schema
await new MigrationRunner([User]).sync()

// Query with builder
const repo = new Repository(User)
const users = await repo.find()
  .where({ name: "Maria" })
  .orderBy("id", "DESC")
  .limit(10)
  .getMany()

// Transaction
await Database.transaction(async (trx) => {
  await repo.save({ name: "Ana", email: "ana@example.com" }, trx)
})
```

## Development

```bash
bun install
bun test
bun run examples/basic-crud/index.ts
```
```

### Step 2: Commit

```bash
git add README.md
git commit -m "docs: update README with order-of-relations API and quick start"
```

---

## Final Check

Run the full test suite one last time:

```bash
bun test
```

Expected output: all tests pass with zero failures.
