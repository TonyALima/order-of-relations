import { test, expect, describe } from 'bun:test';

import { Database, DatabaseError, DatabaseNotConnectedError } from './database';
import { OrmError } from './orm-error';
import { COLUMN_TYPE } from './sql-types';

class DatabaseTestEntity {
  id!: number;
  name!: string;
  isActive!: boolean;
}

Database.getInstance().getMetadata().set(DatabaseTestEntity, {
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

describe('DatabaseNotConnectedError', () => {
  test('instanceof chain: OrmError > DatabaseError > DatabaseNotConnectedError', () => {
    const err = new DatabaseNotConnectedError();
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err).toBeInstanceOf(DatabaseNotConnectedError);
  });

  test('has correct name and message', () => {
    const err = new DatabaseNotConnectedError();
    expect(err.name).toBe('DatabaseNotConnectedError');
    expect(err.message).toBe('Database not connected. Call Database.connect() first.');
  });
});

describe('Database', () => {
  describe('create()', () => {
    test('applies the mapped schema to an in-memory SQLite database', async () => {
      const db = Database.getInstance();
      db.connect('sqlite://:memory:');

      await db.create();

      const sql = db.getConnection();
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
  });

  describe('drop()', () => {
    test('removes the mapped tables from an in-memory SQLite database', async () => {
      const db = Database.getInstance();
      db.connect('sqlite://:memory:');

      await db.create();
      await db.drop();

      const sql = db.getConnection();
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
      if (!(insertError instanceof Error)) throw insertError;
      expect(insertError.message).toContain('no such table');
    });
  });
});
