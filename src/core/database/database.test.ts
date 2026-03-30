import { test, expect, describe, spyOn, beforeEach } from 'bun:test';

import { Database } from './database';
import { DatabaseError, DatabaseNotConnectedError } from './database.errors';
import { OrmError } from '../orm-error';
import { RelationType } from '../metadata/metadata';
import { COLUMN_TYPE } from '../sql-types/sql-types';

class DatabaseTestEntity {
  id!: number;
  name!: string;
  isActive!: boolean;
}

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
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spyOn(Database, 'getInstance').mockReturnValue(new (Database as any)());

    Database.getInstance()
      .getMetadata()
      .set(DatabaseTestEntity, {
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
  });

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

  describe('createRelations() (via create())', () => {
    class UserEntity {
      id!: number;
    }

    class PostEntity {
      id!: number;
      author?: UserEntity;
    }

    beforeEach(() => {
      const db = Database.getInstance();

      db.getMetadata().set(UserEntity, {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true },
        ],
        relations: [],
      });

      db.getMetadata().set(PostEntity, {
        tableName: 'posts',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true },
        ],
        relations: [
          {
            propertyName: 'author',
            columnName: null, // resolved by MetadataStorage to 'author_id'
            relationType: RelationType.TO_ONE,
            columnType: 'unresolved', // resolved by MetadataStorage to the target PK type
            getTarget: () => UserEntity,
          },
        ],
      });
    });

    test('adds FK column with auto-resolved name (<propertyName>_<pkPropertyName>) to the owning table', async () => {
      const db = Database.getInstance();
      db.connect('sqlite://:memory:');
      await db.create();

      const sql = db.getConnection();
      const columns = await sql`PRAGMA table_info(posts)`;
      const columnNames = columns.map((c: unknown) => (c as { name: string }).name);

      expect(columnNames).toContain('author_id');
    });

    test('FK column references the correct target table and primary column', async () => {
      const db = Database.getInstance();
      db.connect('sqlite://:memory:');
      await db.create();

      const sql = db.getConnection();
      const [fk] = await sql`PRAGMA foreign_key_list(posts)`;
      const foreignKey = fk as { table: string; from: string; to: string };

      expect(foreignKey.table).toBe('users');
      expect(foreignKey.from).toBe('author_id');
      expect(foreignKey.to).toBe('id');
    });

    test('uses custom foreignKey column name when provided', async () => {
      const db = Database.getInstance();

      db.getMetadata().set(PostEntity, {
        tableName: 'posts',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true },
        ],
        relations: [
          {
            propertyName: 'author',
            columnName: 'custom_author_fk',
            relationType: RelationType.TO_ONE,
            columnType: 'unresolved',
            getTarget: () => UserEntity,
          },
        ],
      });

      db.connect('sqlite://:memory:');
      await db.create();

      const sql = db.getConnection();
      const columns = await sql`PRAGMA table_info(posts)`;
      const columnNames = columns.map((c: unknown) => (c as { name: string }).name);

      expect(columnNames).toContain('custom_author_fk');
    });
  });

  describe('drop()', () => {
    test('removes the mapped tables from an in-memory SQLite database', async () => {
      const db = Database.getInstance();
      db.connect('sqlite://:memory:');

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
