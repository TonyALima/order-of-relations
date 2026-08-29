---
name: bun-testing
description: Use when writing, debugging, or reviewing tests with bun:test in a Bun/TypeScript project. Covers test/describe blocks, expect matchers, async tests, lifecycle hooks, spies, parametrized tests, and test modifiers (skip/only/todo).
---

# Bun Testing (`bun:test`)

## Overview

Bun has a built-in Jest-compatible test runner. Import everything from `bun:test`. Run tests with `bun test`.

```ts
import { test, describe, expect, beforeEach, afterEach, spyOn } from 'bun:test';
```

## Test & Describe Blocks

```ts
test('2 + 2 equals 4', () => {
  expect(2 + 2).toBe(4);
});

describe('arithmetic', () => {
  test('addition', () => {
    expect(1 + 1).toBe(2);
  });

  describe('nested', () => {
    test('subtraction', () => {
      expect(3 - 1).toBe(2);
    });
  });
});
```

## Lifecycle Hooks

```ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

beforeAll(async () => { /* once before all tests in block */ });
afterAll(async () => {  /* once after all tests in block  */ });
beforeEach(() => {      /* before each test               */ });
afterEach(() => {       /* after each test                */ });
```

Hooks are scoped to the nearest `describe` block. Top-level hooks apply to the whole file.

## Async Tests

```ts
test('resolves correctly', async () => {
  const result = await Promise.resolve(42);
  expect(result).toBe(42);
});

// With timeout (ms) as second arg
test('slow op', async () => {
  await slowOp();
}, 10_000);

// Promise matchers
test('rejects on bad input', async () => {
  await expect(Promise.reject(new Error('oops'))).rejects.toThrow('oops');
  await expect(Promise.resolve('ok')).resolves.toBe('ok');
});
```

## Common `expect` Matchers

| Matcher | Use for |
|---|---|
| `.toBe(v)` | Strict equality (`===`) |
| `.toEqual(v)` | Deep equality |
| `.toStrictEqual(v)` | Deep equality + same type |
| `.toBeUndefined()` / `.toBeDefined()` | Presence checks |
| `.toBeNull()` | Null check |
| `.toBeNaN()` | NaN check |
| `.toBeTruthy()` / `.toBeFalsy()` | Truthiness |
| `.toBeInstanceOf(Class)` | `instanceof` |
| `.toThrow('msg')` | Exception thrown |
| `.toContain(v)` | Array/string includes |
| `.toContainEqual(v)` | Array contains deep-equal item |
| `.toHaveLength(n)` | `.length` check |
| `.toHaveProperty('key')` | Object property |
| `.toMatchObject({...})` | Partial object match |
| `.toBeGreaterThan(n)` | Numeric comparison |
| `.toBeLessThan(n)` / `.toBeGreaterThanOrEqual(n)` / `.toBeLessThanOrEqual(n)` | Numeric comparison |
| `.toBeCloseTo(n, digits?)` | Floating-point approximate equality |
| `.toMatch(/regex/)` | String regex match |
| `.toMatchSnapshot()` | Snapshot comparison |
| `.toMatchInlineSnapshot(str)` | Inline snapshot comparison |
| `.not` | Negation modifier |

## Asymmetric Matchers

Use inside `toEqual` / `toMatchObject` for partial matching:

```ts
expect({ id: 1, name: 'Alice' }).toEqual({
  id: expect.any(Number),
  name: expect.stringContaining('Ali'),
});

expect([1, 2, 3]).toEqual(expect.arrayContaining([1, 3]));
expect('hello world').toEqual(expect.stringMatching(/world/));
expect({ a: 1 }).toEqual(expect.objectContaining({ a: 1 }));
expect(42).toEqual(expect.anything()); // matches anything except null/undefined
```

## Spies & Mocks

```ts
import { spyOn, mock } from 'bun:test';

// Spy on an object method
const spy = spyOn(myObj, 'methodName');
myObj.methodName('arg');

expect(spy).toHaveBeenCalled();
expect(spy).toHaveBeenCalledTimes(1);
expect(spy).toHaveBeenCalledWith('arg');
expect(spy).toHaveBeenLastCalledWith('arg');
expect(spy).toHaveBeenNthCalledWith(1, 'arg');

// Return value assertions
expect(spy).toHaveReturned();
expect(spy).toHaveReturnedTimes(1);
expect(spy).toHaveReturnedWith('value');
expect(spy).toHaveLastReturnedWith('value');

// Override implementation
spy.mockImplementation(() => 'faked');

// Restore original
spy.mockRestore();

// Mock a module function
const fn = mock(() => 42);
expect(fn()).toBe(42);
expect(fn).toHaveBeenCalled();
```

## Test Modifiers

```ts
test.skip('not ready yet', () => { /* skipped */ });
test.todo('implement later');
test.only('only this runs', () => { /* isolates to one test */ });

// Conditional
const isPg = process.env.DB === 'postgres';
test.if(isPg)('postgres-only', () => { ... });
test.skipIf(!isPg)('skip when no postgres', () => { ... });
test.todoIf(!isPg)('mark as todo when no postgres', () => { ... });

// Known failures (inverts result)
test.failing('known bug', () => {
  expect(brokenFn()).toBe(true); // passes even though it throws/fails
});
```

All modifiers (`.if`, `.skipIf`, `.todoIf`) also work on **`describe`** blocks:

```ts
describe.skipIf(process.env.CI === 'true')('local-only suite', () => { ... });
```

Use `bun test --todo` to list all passing `.todo` tests.

## Parametrized Tests (`test.each`)

```ts
const cases: [number, number, number][] = [
  [1, 2, 3],
  [3, 4, 7],
];

test.each(cases)('%i + %i = %i', (a, b, expected) => {
  expect(a + b).toBe(expected);
});

// With objects
test.each([{ input: 'hello', expected: 5 }])('length of $input', ({ input, expected }) => {
  expect(input.length).toBe(expected);
});
```

Format specifiers: `%p` pretty-print, `%s` string, `%d`/`%i` integer, `%f` float, `%j` JSON, `%o` object, `%#` index, `%%` literal percent.

`describe.each` works the same way for grouping parametrized suites.

## Retry & Repeat

```ts
test('flaky network call', async () => {
  await fetch('https://example.com');
}, { retry: 3 }); // retries on failure (up to 3 more times)

test('must pass consistently', () => {
  expect(Math.random()).toBeLessThan(1);
}, { repeats: 10 }); // runs 11 times total
```

Cannot combine `retry` and `repeats` on the same test.

## Assertion Counting

```ts
test('verifies at least one assertion ran', async () => {
  expect.hasAssertions(); // fails if zero assertions execute
  await resolveA();
  expect(true).toBe(true);
});

test('verifies exactly N assertions', async () => {
  expect.assertions(2); // fails if exactly 2 assertions don't run
  expect(true).toBe(true);
  expect(true).toBe(true);
});
```

Use `expect.hasAssertions()` to catch tests that pass silently when async code never executes.

## Type Assertions

```ts
import { expectTypeOf } from 'bun:test';

expectTypeOf<string>().toEqualTypeOf<string>();
expectTypeOf(42).toBeNumber();
expectTypeOf(greet).parameters.toEqualTypeOf<[string]>();
expectTypeOf(greet).returns.toEqualTypeOf<string>();
expectTypeOf(Promise.resolve(42)).resolves.toBeNumber();
```

These are compile-time only (no-ops at runtime). Run `bunx tsc --noEmit` to verify.

## Zombie Process Killer

Bun automatically kills spawned child processes from timed-out tests. Processes created via `Bun.spawn()`, `Bun.spawnSync()`, or `node:child_process` are terminated when a test times out — no manual cleanup needed.

## Best Practices

- **Descriptive names**: state what is tested and what the expected outcome is.
- **Group with `describe`**: organize by feature or scenario, not by file.
- **Prefer specific matchers**: `.toHaveLength(3)` over `.toBe(3)` for `.length` — better error messages.
- **Test both paths**: assert success cases and failure/rejection cases.
- **Use `expect.hasAssertions()`** in async tests to catch silent passes when async branches are skipped.
- **Avoid `test.only` in committed code** — it silences other tests in the file.

## Project Patterns (order-of-relations)

**Register metadata at module level** (outside test blocks — runs once per file):
```ts
Database.getInstance().getMetadata().set(MyEntity, {
  tableName: 'my_table',
  columns: [{ propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true }],
  relations: [],
});
```

**In-memory SQLite for integration tests** (no real Postgres needed):
```ts
import { SQL } from 'bun';

const sql = new SQL({ url: 'sqlite://:memory:' });
await sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`;
await sql`INSERT INTO users (name) VALUES ('Alice')`;
```

**Test isolation without lifecycle hooks** — use fresh class instances inside each test:
```ts
test('stores metadata', () => {
  const storage = new MetadataStorage(); // fresh instance per test
  class User {}
  storage.set(User, { ... });
  expect(storage.get(User)).toBeDefined();
});
```

**Error type assertions** — test the full inheritance chain:
```ts
test('instanceof chain', () => {
  const err = new DatabaseNotConnectedError();
  expect(err).toBeInstanceOf(OrmError);       // base
  expect(err).toBeInstanceOf(DatabaseError);  // mid
  expect(err).toBeInstanceOf(DatabaseNotConnectedError); // concrete
});
```
