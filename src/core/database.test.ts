import { test, expect } from 'bun:test';

import { Database } from './database';
import { metadataStorage } from './metadata';
import { COLUMN_TYPE } from './sql-types';

class DatabaseTestEntity {
  id!: number;
  name!: string;
  isActive!: boolean;
}

metadataStorage.set(DatabaseTestEntity, {
  tableName: 'database_test_entity',
  columns: [
    {
      propertyName: 'id',
      columnName: 'id',
      type: COLUMN_TYPE.SERIAL,
      primary: true,
    },
    {
      propertyName: 'name',
      columnName: 'name',
      type: COLUMN_TYPE.TEXT,
    },
    {
      propertyName: 'isActive',
      columnName: 'is_active',
      type: COLUMN_TYPE.BOOLEAN,
    },
  ],
  relations: [],
});

test('Database.create applies the mapped schema to an in-memory SQLite database', async () => {
  Database.connect('sqlite://:memory:');

  await Database.create();

  const sql = Database.getConnection();
  const [table] = await sql`
		SELECT name, sql
		FROM sqlite_master
		WHERE type = 'table' AND name = 'database_test_entity'
	`;
  const columns = await sql`PRAGMA table_info(database_test_entity)`;
  const normalizedColumns = Array.from(columns, (column) => {
    const tableColumn = column as { name: string; type: string; pk: number };

    return {
      name: tableColumn.name,
      type: tableColumn.type,
      pk: tableColumn.pk,
    };
  });

  expect(table.name).toBe('database_test_entity');

  expect(normalizedColumns).toEqual([
    { name: 'id', type: 'SERIAL', pk: 1 },
    { name: 'name', type: 'TEXT', pk: 0 },
    { name: 'is_active', type: 'BOOLEAN', pk: 0 },
  ]);

  await sql`
		INSERT INTO database_test_entity (id, name, is_active)
		VALUES (1, 'Alice', TRUE)
	`;

  const [rowCount] = await sql`SELECT COUNT(*) AS count FROM database_test_entity`;
  expect(Number(rowCount.count)).toBe(1);
});

test('Database.drop removes the mapped tables from an in-memory SQLite database', async () => {
  Database.connect('sqlite://:memory:');

  await Database.create();
  await Database.drop();

  const sql = Database.getConnection();
  const droppedTables = await sql`
		SELECT name
		FROM sqlite_master
		WHERE type = 'table' AND name = 'database_test_entity'
	`;

  expect(droppedTables).toHaveLength(0);

  let insertError: unknown;

  try {
    await sql`
			INSERT INTO database_test_entity (id, name, is_active)
			VALUES (1, 'Alice', TRUE)
		`;
  } catch (error) {
    insertError = error;
  }

  expect(insertError).toBeInstanceOf(Error);

  if (!(insertError instanceof Error)) {
    throw insertError;
  }

  expect(insertError.message).toContain('no such table');
});
