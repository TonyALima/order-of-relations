import { describe, test, expect, spyOn } from 'bun:test';
import { SQL } from 'bun';
import { QueryBuilder } from './query-builder';
import { Repository } from '../core/repository';
import { Database } from '../core/database';
import { COLUMN_TYPE } from '../core/sql-types';
import type { Condition } from './types';

// ── Test entity registered directly in metadata (no DB connection needed) ────

class QbUser {
  id!: number;
  name!: string;
  age!: number;
}

Database.getInstance()
  .getMetadata()
  .set(QbUser, {
    tableName: 'qb_users',
    columns: [
      { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true },
      { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT },
      { propertyName: 'age', columnName: 'age', type: COLUMN_TYPE.INTEGER },
    ],
    relations: [],
  });

async function setupDb(): Promise<SQL> {
  const sql = new SQL({ url: 'sqlite://:memory:' });
  await sql`CREATE TABLE qb_users (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL,
    age  INTEGER NOT NULL
  )`;
  await sql`INSERT INTO qb_users (name, age) VALUES ('Alice', 30)`;
  await sql`INSERT INTO qb_users (name, age) VALUES ('Bob', 17)`;
  await sql`INSERT INTO qb_users (name, age) VALUES ('Carol', 30)`;
  return sql;
}

// ── Condition proxy unit tests (no DB required) ───────────────────────────────

describe('QueryBuilder - conditions proxy', () => {
  test('buildConditionsProxyForTest returns keys matching entity properties', () => {
    const db = Database.getInstance();
    const sql = new SQL({ url: 'sqlite://:memory:' });
    spyOn(db, 'getConnection').mockReturnValue(sql);

    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    expect(proxy).toHaveProperty('id');
    expect(proxy).toHaveProperty('name');
    expect(proxy).toHaveProperty('age');
  });

  test('eq returns correct Condition', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.name?.eq('Alice');
    expect(condition).toEqual({ columnName: 'name', op: '=', value: 'Alice' });
  });

  test('ne returns correct Condition', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.name?.ne('Alice');
    expect(condition).toEqual({ columnName: 'name', op: '!=', value: 'Alice' });
  });

  test('gt returns correct Condition', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.age?.gt(18);
    expect(condition).toEqual({ columnName: 'age', op: '>', value: 18 });
  });

  test('gte returns correct Condition', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.age?.gte(18);
    expect(condition).toEqual({ columnName: 'age', op: '>=', value: 18 });
  });

  test('lt returns correct Condition', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.age?.lt(65);
    expect(condition).toEqual({ columnName: 'age', op: '<', value: 65 });
  });

  test('lte returns correct Condition', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.age?.lte(65);
    expect(condition).toEqual({ columnName: 'age', op: '<=', value: 65 });
  });

  test('isNull returns Condition without value', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.name?.isNull();
    expect(condition).toEqual({ columnName: 'name', op: 'IS NULL' });
  });

  test('isNotNull returns Condition without value', () => {
    const qb = new QueryBuilder(QbUser);
    const proxy = qb.buildConditionsProxyForTest();
    const condition: Condition | undefined = proxy.name?.isNotNull();
    expect(condition).toEqual({ columnName: 'name', op: 'IS NOT NULL' });
  });

  test('applyOptions accumulates conditions from where callback', () => {
    const qb = new QueryBuilder(QbUser);
    qb.applyOptions({ where: (u) => [u.name?.eq('Alice'), u.age?.gte(18)] });
    expect(qb.getConditionsForTest()).toEqual([
      { columnName: 'name', op: '=', value: 'Alice' },
      { columnName: 'age', op: '>=', value: 18 },
    ]);
  });

  test('applyOptions with no options leaves conditions empty', () => {
    const qb = new QueryBuilder(QbUser);
    qb.applyOptions();
    expect(qb.getConditionsForTest()).toEqual([]);
  });

  test('applyOptions throws when a condition entry is undefined (non-column field access)', () => {
    const qb = new QueryBuilder(QbUser);
    expect(() =>
      qb.applyOptions({ where: (u) => [u.name?.eq('Alice'), undefined] }),
    ).toThrow('where() condition at index 1 is undefined');
  });

  test('applyOptions throws when the only condition is undefined', () => {
    const qb = new QueryBuilder(QbUser);
    expect(() => qb.applyOptions({ where: () => [undefined] })).toThrow(
      'where() condition at index 0 is undefined',
    );
  });
});

// ── Repository integration tests ─────────────────────────────────────────────

describe('Repository - findMany', () => {
  test('findMany with no options returns all rows', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const users = await repo.findMany();
    expect(users.length).toBe(3);
  });

  test('findMany with where eq filters correctly', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const users = await repo.findMany({ where: (u) => [u.name?.eq('Alice')] });
    expect(users.length).toBe(1);
    expect(users[0]!.name).toBe('Alice');
  });

  test('findMany with multiple AND conditions filters correctly', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const users = await repo.findMany({
      where: (u) => [u.age?.eq(30), u.name?.ne('Alice')],
    });
    expect(users.length).toBe(1);
    expect(users[0]!.name).toBe('Carol');
  });

  test('findMany with gte filters correctly', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const users = await repo.findMany({ where: (u) => [u.age?.gte(18)] });
    expect(users.length).toBe(2);
  });

  test('findMany returns empty array when no rows match', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const users = await repo.findMany({ where: (u) => [u.name?.eq('Nobody')] });
    expect(users).toEqual([]);
  });
});

describe('Repository - findOne', () => {
  test('findOne returns first matching row', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const user = await repo.findOne({ where: (u) => [u.name?.eq('Bob')] });
    expect(user).not.toBeNull();
    expect(user!.name).toBe('Bob');
  });

  test('findOne returns null when no row matches', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const user = await repo.findOne({ where: (u) => [u.name?.eq('Nobody')] });
    expect(user).toBeNull();
  });

  test('findOne with no options returns first row', async () => {
    const sql = await setupDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);

    const repo = new Repository(QbUser);
    const user = await repo.findOne();
    expect(user).not.toBeNull();
  });
});
