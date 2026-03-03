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
