import { test, expect, describe, beforeEach } from 'bun:test';

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
  let db: Database;

  beforeEach(() => {
    db = new Database();

    db.getMetadata().set(DatabaseTestEntity, {
      tableName: 'database_test_entity',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
        },
        {
          propertyName: 'name',
          columnName: 'name',
          type: COLUMN_TYPE.TEXT,
          nullable: false,
        },
        {
          propertyName: 'isActive',
          columnName: 'is_active',
          type: COLUMN_TYPE.BOOLEAN,
          nullable: false,
        },
      ],
      relations: [],
    });
  });

  describe('create()', () => {
    test('creates a table with a composite primary key', async () => {
      class OrderItemEntity {
        orderId!: number;
        productId!: number;
        quantity!: number;
      }

      const compositeDb = new Database();
      compositeDb.getMetadata().set(OrderItemEntity, {
        tableName: 'order_items',
        columns: [
          {
            propertyName: 'orderId',
            columnName: 'order_id',
            type: COLUMN_TYPE.INTEGER,
            primary: true,
            nullable: false,
          },
          {
            propertyName: 'productId',
            columnName: 'product_id',
            type: COLUMN_TYPE.INTEGER,
            primary: true,
            nullable: false,
          },
          { propertyName: 'quantity', columnName: 'quantity', type: COLUMN_TYPE.INTEGER, nullable: false },
        ],
        relations: [],
      });

      compositeDb.connect('sqlite://:memory:');
      await compositeDb.create();

      const sql = compositeDb.getConnection();
      const columns = await sql`PRAGMA table_info(order_items)`;
      const normalizedColumns = Array.from(columns, (column) => {
        const c = column as { name: string; type: string; pk: number };
        return { name: c.name, type: c.type, pk: c.pk };
      });

      expect(normalizedColumns).toEqual([
        { name: 'order_id', type: 'INTEGER', pk: 1 },
        { name: 'product_id', type: 'INTEGER', pk: 2 },
        { name: 'quantity', type: 'INTEGER', pk: 0 },
      ]);
    });

    test('emits NOT NULL for non-nullable columns and omits it for nullable columns', async () => {
      class NullTestEntity {
        id!: number;
        requiredName!: string;
        optionalBio?: string;
      }

      const nullDb = new Database();
      nullDb.getMetadata().set(NullTestEntity, {
        tableName: 'null_test',
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: COLUMN_TYPE.SERIAL,
            primary: true,
            nullable: false,
          },
          {
            propertyName: 'requiredName',
            columnName: 'required_name',
            type: COLUMN_TYPE.TEXT,
            nullable: false,
          },
          {
            propertyName: 'optionalBio',
            columnName: 'optional_bio',
            type: COLUMN_TYPE.TEXT,
            nullable: true,
          },
        ],
        relations: [],
      });

      nullDb.connect('sqlite://:memory:');
      await nullDb.create();

      const sql = nullDb.getConnection();
      const columns = await sql`PRAGMA table_info(null_test)`;
      const normalizedColumns = Array.from(columns, (column) => {
        const c = column as { name: string; notnull: number; pk: number };
        return { name: c.name, notnull: c.notnull, pk: c.pk };
      });

      expect(normalizedColumns).toEqual([
        { name: 'id', notnull: 0, pk: 1 },
        { name: 'required_name', notnull: 1, pk: 0 },
        { name: 'optional_bio', notnull: 0, pk: 0 },
      ]);
    });

    test('applies the mapped schema to an in-memory SQLite database', async () => {
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
      db.getMetadata().set(UserEntity, {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [],
      });

      db.getMetadata().set(PostEntity, {
        tableName: 'posts',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [
          {
            propertyName: 'author',
            columns: null, // resolved by MetadataStorage to the target PK columns
            relationType: RelationType.TO_ONE,
            getTarget: () => UserEntity,
          },
        ],
      });
    });

    test('adds FK column with auto-resolved name (<propertyName>_<pkPropertyName>) to the owning table', async () => {
      db.connect(process.env.DATABASE_URL);
      await db.drop();
      await db.create();

      const sql = db.getConnection();
      const columns = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'posts' AND table_schema = 'public'
      `;
      const columnNames = columns.map((c: unknown) => (c as { column_name: string }).column_name);

      expect(columnNames).toContain('author_id');
    });

    test('FK column references the correct target table and primary column', async () => {
      db.connect(process.env.DATABASE_URL);
      await db.drop();
      await db.create();

      const sql = db.getConnection();
      const [fk] = await sql`
        SELECT
          kcu.column_name AS from_col,
          ccu.table_name AS to_table,
          ccu.column_name AS to_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'posts'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      `;
      const foreignKey = fk as { to_table: string; from_col: string; to_col: string };

      expect(foreignKey.to_table).toBe('users');
      expect(foreignKey.from_col).toBe('author_id');
      expect(foreignKey.to_col).toBe('id');
    });

    test('uses custom foreignKey column name when provided', async () => {
      db.getMetadata().set(PostEntity, {
        tableName: 'posts',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [
          {
            propertyName: 'author',
            relationType: RelationType.TO_ONE,
            columns: [{ name: 'custom_author_fk', type: COLUMN_TYPE.INTEGER }],
            getTarget: () => UserEntity,
          },
        ],
      });

      db.connect(process.env.DATABASE_URL);
      await db.drop();
      await db.create();

      const sql = db.getConnection();
      const columns = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'posts' AND table_schema = 'public'
      `;
      const columnNames = columns.map((c: unknown) => (c as { column_name: string }).column_name);

      expect(columnNames).toContain('custom_author_fk');
    });

    test('adds FK columns for composite primary key relation', async () => {
      class OrderItemEntity {
        orderId!: number;
        productId!: number;
      }

      class OrderEntity {
        id!: number;
        orderItem?: OrderItemEntity;
      }

      const compositeDb = new Database();
      compositeDb.getMetadata().set(OrderItemEntity, {
        tableName: 'order_items',
        columns: [
          {
            propertyName: 'orderId',
            columnName: 'order_id',
            type: COLUMN_TYPE.INTEGER,
            primary: true,
            nullable: false,
          },
          {
            propertyName: 'productId',
            columnName: 'product_id',
            type: COLUMN_TYPE.INTEGER,
            primary: true,
            nullable: false,
          },
        ],
        relations: [],
      });
      compositeDb.getMetadata().set(OrderEntity, {
        tableName: 'orders',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [
          {
            propertyName: 'orderItem',
            columns: null,
            relationType: RelationType.TO_ONE,
            getTarget: () => OrderItemEntity,
          },
        ],
      });

      compositeDb.connect(process.env.DATABASE_URL);
      await compositeDb.drop();
      await compositeDb.create();

      const sql = compositeDb.getConnection();
      const columns = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'orders' AND table_schema = 'public'
      `;
      const columnNames = columns.map((c: unknown) => (c as { column_name: string }).column_name);

      expect(columnNames).toContain('orderItem_orderId');
      expect(columnNames).toContain('orderItem_productId');
    });
  });

  describe('drop()', () => {
    test('removes the mapped tables from an in-memory SQLite database', async () => {
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
