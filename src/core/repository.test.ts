import { test, expect, spyOn } from 'bun:test';
import { SQL } from 'bun';
import { Repository } from './repository';
import { Database } from './database';
import { COLUMN_TYPE } from './sql-types';

class TestEntity {
  id!: number;
  name!: string;
}

Database.getInstance().getMetadata().set(TestEntity, {
  tableName: 'test_entity',
  columns: [
    { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true },
    { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT },
  ],
  relations: [],
});

// Create a fresh in-memory SQLite database with the test schema.
async function setupDb(): Promise<SQL> {
  const sql = new SQL({ url: 'sqlite://:memory:' });
  await sql`CREATE TABLE test_entity (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`;
  return sql;
}

test('Repository.findOne returns the entity when a matching row exists', async () => {
  const sql = await setupDb();
  await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;

  const db = Database.getInstance();
  spyOn(db, 'getConnection').mockReturnValue(sql);

  const repo = new Repository<TestEntity>(TestEntity);
  const result = await repo.findOne(1);

  expect(result).toEqual({ id: 1, name: 'Alice' });
});

test('Repository.findOne returns null when no matching row exists', async () => {
  const sql = await setupDb();

  const db = Database.getInstance();
  spyOn(db, 'getConnection').mockReturnValue(sql);

  const repo = new Repository<TestEntity>(TestEntity);
  const result = await repo.findOne(999);

  expect(result).toBeNull();
});

test('Repository.findAll returns all rows from the table', async () => {
  const sql = await setupDb();
  await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;
  await sql`INSERT INTO test_entity (name) VALUES ('Bob')`;

  const db = Database.getInstance();
  spyOn(db, 'getConnection').mockReturnValue(sql);

  const repo = new Repository<TestEntity>(TestEntity);
  const result = await repo.findAll();

  expect(result).toEqual([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]);
});

test('Repository.create inserts a row and returns the generated primary key', async () => {
  const sql = await setupDb();

  const db = Database.getInstance();
  spyOn(db, 'getConnection').mockReturnValue(sql);

  const repo = new Repository<TestEntity>(TestEntity);
  const newId = await repo.create({ name: 'Alice' });

  expect(newId).toBe(1);

  const [row] = await sql`SELECT * FROM test_entity WHERE id = ${newId}`;
  expect(row).toEqual({ id: 1, name: 'Alice' });
});

test('Repository.update changes the row identified by the primary key', async () => {
  const sql = await setupDb();
  await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;

  const db = Database.getInstance();
  spyOn(db, 'getConnection').mockReturnValue(sql);

  const repo = new Repository<TestEntity>(TestEntity);
  await repo.update({ id: 1, name: 'Bob' });

  const [row] = await sql`SELECT * FROM test_entity WHERE id = 1`;
  expect(row).toEqual({ id: 1, name: 'Bob' });
});

test('Repository.delete removes the row with the given id', async () => {
  const sql = await setupDb();
  await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;

  const db = Database.getInstance();
  spyOn(db, 'getConnection').mockReturnValue(sql);

  const repo = new Repository<TestEntity>(TestEntity);
  await repo.delete(1);

  const remaining = await sql`SELECT * FROM test_entity`;
  expect(remaining).toHaveLength(0);
});
