import { test, expect, spyOn } from 'bun:test';
import type { SQL } from 'bun';
import { Repository } from './repository';
import { Database } from './database';
import { metadataStorage } from './metadata';

class TestEntity {
  id!: number;
  name!: string;
}

metadataStorage.set(TestEntity, {
  tableName: 'test_entity',
  columns: [
    { propertyName: 'id', columnName: 'id', type: 'serial', primary: true },
    { propertyName: 'name', columnName: 'name', type: 'text' },
  ],
  relations: [],
});

test('Repository.findOne returns the entity when a matching row exists', async () => {
  const executedQueries: { template: string; values: unknown[] }[] = [];
  const mockRow = { id: 1, name: 'Alice' };

  const mockSql = ((stringsOrIdentifier: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof stringsOrIdentifier === 'string') {
      return stringsOrIdentifier;
    }
    executedQueries.push({ template: stringsOrIdentifier.join('?'), values });
    return Promise.resolve([mockRow]);
  }) as unknown as SQL;

  spyOn(Database, 'getConnection').mockReturnValue(mockSql);

  const repo = new Repository<TestEntity>(TestEntity);
  const result = await repo.findOne(1);

  expect(executedQueries).toHaveLength(1);
  expect(executedQueries[0]!.template.toUpperCase()).toContain('SELECT');
  expect(executedQueries[0]!.values).toContain(1);
  expect(result).toEqual(mockRow);
});

test('Repository.findOne returns null when no matching row exists', async () => {
  const mockSql = ((stringsOrIdentifier: TemplateStringsArray | string) => {
    if (typeof stringsOrIdentifier === 'string') {
      return stringsOrIdentifier;
    }
    return Promise.resolve([]);
  }) as unknown as SQL;

  spyOn(Database, 'getConnection').mockReturnValue(mockSql);

  const repo = new Repository<TestEntity>(TestEntity);
  const result = await repo.findOne(999);

  expect(result).toBeNull();
});

test('Repository.findAll returns all rows from the table', async () => {
  const mockRows = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];

  const mockSql = ((stringsOrIdentifier: TemplateStringsArray | string) => {
    if (typeof stringsOrIdentifier === 'string') {
      return stringsOrIdentifier;
    }
    return Promise.resolve(mockRows);
  }) as unknown as SQL;

  spyOn(Database, 'getConnection').mockReturnValue(mockSql);

  const repo = new Repository<TestEntity>(TestEntity);
  const result = await repo.findAll();

  expect(result).toEqual(mockRows);
});

test('Repository.create executes INSERT query and returns the generated primary key', async () => {
  const executedQueries: { template: string; values: unknown[] }[] = [];

  const mockSql = ((
    stringsOrIdentifier: TemplateStringsArray | string | Record<string, unknown>,
    ...values: unknown[]
  ) => {
    if (!Array.isArray(stringsOrIdentifier)) {
      return stringsOrIdentifier;
    }
    executedQueries.push({ template: stringsOrIdentifier.join('?'), values });
    return Promise.resolve([{ id: 99 }]);
  }) as unknown as SQL;

  spyOn(Database, 'getConnection').mockReturnValue(mockSql);

  const repo = new Repository<TestEntity>(TestEntity);
  const newId = await repo.create({ name: 'Alice' });

  expect(executedQueries).toHaveLength(1);
  expect(executedQueries[0]!.template.toUpperCase()).toContain('INSERT');
  expect(newId).toBe(99);
});

test('Repository.update executes UPDATE query using the entity primary key', async () => {
  const executedQueries: { template: string; values: unknown[] }[] = [];

  const mockSql = ((
    stringsOrIdentifier: TemplateStringsArray | string | Record<string, unknown>,
    ...values: unknown[]
  ) => {
    if (!Array.isArray(stringsOrIdentifier)) {
      return stringsOrIdentifier;
    }
    executedQueries.push({ template: stringsOrIdentifier.join('?'), values });
    return Promise.resolve([]);
  }) as unknown as SQL;

  spyOn(Database, 'getConnection').mockReturnValue(mockSql);

  const repo = new Repository<TestEntity>(TestEntity);
  await repo.update({ id: 5, name: 'Bob' });

  expect(executedQueries).toHaveLength(1);
  expect(executedQueries[0]!.template.toUpperCase()).toContain('UPDATE');
  expect(executedQueries[0]!.values).toContain(5);
});

test('Repository.delete executes DELETE WHERE query for the given id', async () => {
  const executedQueries: { template: string; values: unknown[] }[] = [];

  const mockSql = ((stringsOrIdentifier: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof stringsOrIdentifier === 'string') {
      return stringsOrIdentifier;
    }
    executedQueries.push({
      template: stringsOrIdentifier.join('?'),
      values,
    });
    return Promise.resolve([]);
  }) as unknown as SQL;

  spyOn(Database, 'getConnection').mockReturnValue(mockSql);

  const repo = new Repository<TestEntity>(TestEntity);
  await repo.delete(42);

  expect(executedQueries).toHaveLength(1);
  expect(executedQueries[0]!.template.toUpperCase()).toContain('DELETE');
  expect(executedQueries[0]!.values).toContain(42);
});
