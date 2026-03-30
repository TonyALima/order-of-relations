import { test, expect, spyOn, describe, beforeEach } from 'bun:test';
import { SQL } from 'bun';
import { Repository } from './repository';
import { Database } from '../database/database';
import { COLUMN_TYPE } from '../sql-types/sql-types';

class TestEntity {
  id!: number;
  name!: string;
}

Database.getInstance()
  .getMetadata()
  .set(TestEntity, {
    tableName: 'test_entity',
    columns: [
      { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true },
      { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT },
    ],
    relations: [],
  });

async function createFreshDb(): Promise<SQL> {
  const sql = new SQL({ url: 'sqlite://:memory:' });
  await sql`CREATE TABLE test_entity (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`;
  return sql;
}

describe('Repository', () => {
  let sql: SQL;
  let repo: Repository<TestEntity>;

  beforeEach(async () => {
    sql = await createFreshDb();
    spyOn(Database.getInstance(), 'getConnection').mockReturnValue(sql);
    repo = new Repository<TestEntity>(TestEntity);
  });

  describe('findById()', () => {
    test('returns the entity when a matching row exists', async () => {
      await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;
      const result = await repo.findById(1);
      expect(result).toEqual({ id: 1, name: 'Alice' });
    });

    test('returns null when no matching row exists', async () => {
      const result = await repo.findById(999);
      expect(result).toBeNull();
    });
  });

  describe('findMany()', () => {
    test('returns all rows from the table', async () => {
      await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;
      await sql`INSERT INTO test_entity (name) VALUES ('Bob')`;
      const result = await repo.findMany();
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });
  });

  describe('create()', () => {
    test('inserts a row and returns the generated primary key', async () => {
      const newId = await repo.create({ name: 'Alice' });
      expect(newId).toBe(1);

      const [row] = await sql`SELECT * FROM test_entity WHERE id = ${newId}`;
      expect(row).toEqual({ id: 1, name: 'Alice' });
    });
  });

  describe('update()', () => {
    test('changes the row identified by the primary key', async () => {
      await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;
      await repo.update({ id: 1, name: 'Bob' });

      const [row] = await sql`SELECT * FROM test_entity WHERE id = 1`;
      expect(row).toEqual({ id: 1, name: 'Bob' });
    });
  });

  describe('delete()', () => {
    test('removes the row with the given id', async () => {
      await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;
      await repo.delete(1);

      const remaining = await sql`SELECT * FROM test_entity`;
      expect(remaining).toHaveLength(0);
    });
  });
});
