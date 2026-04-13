import { describe, test, expect, spyOn, beforeEach } from 'bun:test';
import { SQL } from 'bun';
import { OrmError } from '../core/orm-error';
import { QueryBuilder } from './query-builder';
import { QueryError, UndefinedWhereConditionError } from './query-builder.errors';
import { Repository } from '../core/repository/repository';
import { Database } from '../core/database/database';
import { COLUMN_TYPE } from '../core/sql-types/sql-types';
import type { Condition, Conditions } from './types';

// ── Test entity registered directly in metadata (no DB connection needed) ────

class QbUser {
  id!: number;
  name!: string;
  age!: number;
}

const db = new Database();
db.getMetadata().set(QbUser, {
  tableName: 'qb_users',
  columns: [
    { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
    { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
    { propertyName: 'age', columnName: 'age', type: COLUMN_TYPE.INTEGER, nullable: false },
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

// ── Condition proxy unit tests ────────────────────────────────────────────────

describe('QueryBuilder - conditions proxy', () => {
  test('proxy has keys matching every entity property', () => {
    const qb = new QueryBuilder(QbUser, db);
    let capturedProxy!: Conditions<QbUser>;
    qb.applyOptions({
      where: (u) => {
        capturedProxy = u;
        return [];
      },
    });
    expect(capturedProxy).toHaveProperty('id');
    expect(capturedProxy).toHaveProperty('name');
    expect(capturedProxy).toHaveProperty('age');
  });

  // Comparison operators — parametrized with test.each
  const comparisonCases: Array<[string, (u: Conditions<QbUser>) => Condition, Condition]> = [
    ['eq', (u) => u.name!.eq('Alice'), { columnName: 'name', op: '=', value: 'Alice' }],
    ['ne', (u) => u.name!.ne('Alice'), { columnName: 'name', op: '!=', value: 'Alice' }],
    ['gt', (u) => u.age!.gt(18), { columnName: 'age', op: '>', value: 18 }],
    ['gte', (u) => u.age!.gte(18), { columnName: 'age', op: '>=', value: 18 }],
    ['lt', (u) => u.age!.lt(65), { columnName: 'age', op: '<', value: 65 }],
    ['lte', (u) => u.age!.lte(65), { columnName: 'age', op: '<=', value: 65 }],
    [
      'in',
      (u) => u.name!.in(['Alice', 'Bob']),
      { columnName: 'name', op: 'IN', value: ['Alice', 'Bob'] },
    ],
  ];

  test.each(comparisonCases)('%s returns the correct Condition', (_op, build, expected) => {
    const qb = new QueryBuilder(QbUser, db);
    let captured!: Condition;
    qb.applyOptions({
      where: (u) => {
        captured = build(u);
        return [captured];
      },
    });
    expect(captured).toEqual(expected);
  });

  // Null-check operators
  const nullCases: Array<[string, (u: Conditions<QbUser>) => Condition, Condition]> = [
    ['isNull', (u) => u.name!.isNull(), { columnName: 'name', op: 'IS NULL' }],
    ['isNotNull', (u) => u.name!.isNotNull(), { columnName: 'name', op: 'IS NOT NULL' }],
  ];

  test.each(nullCases)('%s returns a Condition without value', (_op, build, expected) => {
    const qb = new QueryBuilder(QbUser, db);
    let captured!: Condition;
    qb.applyOptions({
      where: (u) => {
        captured = build(u);
        return [captured];
      },
    });
    expect(captured).toEqual(expected);
  });

  test('applyOptions accumulates all conditions from the where callback', () => {
    const qb = new QueryBuilder(QbUser, db);
    qb.applyOptions({ where: (u) => [u.name?.eq('Alice'), u.age?.gte(18)] });
    expect(qb['conditions']).toEqual([
      { columnName: 'name', op: '=', value: 'Alice' },
      { columnName: 'age', op: '>=', value: 18 },
    ]);
  });

  test('applyOptions with no options leaves conditions empty', () => {
    const qb = new QueryBuilder(QbUser, db);
    qb.applyOptions();
    expect(qb['conditions']).toEqual([]);
  });

  test('applyOptions throws UndefinedWhereConditionError when a condition entry is undefined', () => {
    const qb = new QueryBuilder(QbUser, db);
    expect(() => qb.applyOptions({ where: (u) => [u.name?.eq('Alice'), undefined] })).toThrow(
      UndefinedWhereConditionError,
    );
  });

  test('applyOptions throws UndefinedWhereConditionError when the only condition is undefined', () => {
    const qb = new QueryBuilder(QbUser, db);
    expect(() => qb.applyOptions({ where: () => [undefined] })).toThrow(
      UndefinedWhereConditionError,
    );
  });

  test('UndefinedWhereConditionError instanceof chain and conditionIndex property', () => {
    const err = new UndefinedWhereConditionError(2);
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(QueryError);
    expect(err).toBeInstanceOf(UndefinedWhereConditionError);
    expect(err.name).toBe('UndefinedWhereConditionError');
    expect(err.conditionIndex).toBe(2);
  });

  test('thrown error carries the correct conditionIndex', () => {
    const qb = new QueryBuilder(QbUser, db);
    let caught: unknown;
    try {
      qb.applyOptions({ where: (u) => [u.name?.eq('Alice'), undefined] });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UndefinedWhereConditionError);
    if (!(caught instanceof UndefinedWhereConditionError)) throw caught;
    expect(caught.conditionIndex).toBe(1);
  });
});

// ── Repository integration tests ──────────────────────────────────────────────

describe('Repository - findMany', () => {
  let repo: Repository<QbUser>;

  beforeEach(async () => {
    const sql = await setupDb();
    spyOn(db, 'getConnection').mockReturnValue(sql);
    repo = new Repository(QbUser, db);
  });

  const cases = [
    {
      label: 'no options returns all rows',
      options: undefined,
      expectedCount: 3,
      expectedFirstName: undefined,
    },
    {
      label: 'where eq filters correctly',
      options: { where: (u: Conditions<QbUser>) => [u.name?.eq('Alice')] },
      expectedCount: 1,
      expectedFirstName: 'Alice',
    },
    {
      label: 'multiple AND conditions filters correctly',
      options: { where: (u: Conditions<QbUser>) => [u.age?.eq(30), u.name?.ne('Alice')] },
      expectedCount: 1,
      expectedFirstName: 'Carol',
    },
    {
      label: 'gte filters correctly',
      options: { where: (u: Conditions<QbUser>) => [u.age?.gte(18)] },
      expectedCount: 2,
      expectedFirstName: undefined,
    },
    {
      label: 'returns empty array when no rows match',
      options: { where: (u: Conditions<QbUser>) => [u.name?.eq('Nobody')] },
      expectedCount: 0,
      expectedFirstName: undefined,
    },
    {
      label: 'in filters by array of values',
      options: { where: (u: Conditions<QbUser>) => [u.name?.in(['Alice', 'Bob'])] },
      expectedCount: 2,
      expectedFirstName: undefined,
    },
    {
      label: 'in returns empty when no values match',
      options: { where: (u: Conditions<QbUser>) => [u.name?.in(['Nobody', 'Ghost'])] },
      expectedCount: 0,
      expectedFirstName: undefined,
    },
    {
      label: 'in with empty array returns no rows',
      options: { where: (u: Conditions<QbUser>) => [u.name?.in([])] },
      expectedCount: 0,
      expectedFirstName: undefined,
    },
  ];

  test.each(cases)('$label', async ({ options, expectedCount, expectedFirstName }) => {
    const users = await repo.findMany(options);
    expect(users).toHaveLength(expectedCount);
    if (expectedFirstName !== undefined) {
      expect(users[0]!.name).toBe(expectedFirstName);
    }
  });
});

describe('Repository - findOne', () => {
  let repo: Repository<QbUser>;

  beforeEach(async () => {
    const sql = await setupDb();
    spyOn(db, 'getConnection').mockReturnValue(sql);
    repo = new Repository(QbUser, db);
  });

  const cases = [
    {
      label: 'returns first matching row',
      options: { where: (u: Conditions<QbUser>) => [u.name?.eq('Bob')] },
      expectedName: 'Bob' as string | null,
    },
    {
      label: 'returns null when no row matches',
      options: { where: (u: Conditions<QbUser>) => [u.name?.eq('Nobody')] },
      expectedName: null,
    },
    {
      label: 'with no options returns first row',
      options: undefined,
      expectedName: 'Alice' as string | null,
    },
  ];

  test.each(cases)('$label', async ({ options, expectedName }) => {
    const user = await repo.findOne(options);
    if (expectedName === null) {
      expect(user).toBeNull();
    } else {
      expect(user).not.toBeNull();
      expect(user!.name).toBe(expectedName);
    }
  });
});
