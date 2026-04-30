import { test, expect, spyOn, describe, beforeEach } from 'bun:test';
import { SQL } from 'bun';
import { Repository } from './repository';
import { Database } from '../database/database';
import { COLUMN_TYPE } from '../sql-types/sql-types';
import { RelationType } from '../metadata/metadata';
import { IncompletePrimaryKeyError } from './repository.errors';
import { Entity } from '../../decorators/entity/entity';
import { Column, PrimaryColumn } from '../../decorators/column/column';
import type { PrimaryKey } from '../../types';
import { NotNullable } from '../../decorators/nullable/nullable';

class TestEntity {
  id?: PrimaryKey<number>;
  name!: string;
}

const db = new Database();
db.getMetadata().set(TestEntity, {
  tableName: 'test_entity',
  columns: [
    {
      propertyName: 'id',
      columnName: 'id',
      type: COLUMN_TYPE.SERIAL,
      primary: true,
      nullable: false,
      autogeneration: { dbSide: () => undefined },
    },
    { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
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
    spyOn(db, 'getConnection').mockReturnValue(sql);
    repo = new Repository<TestEntity>(TestEntity, db);
  });

  describe('findById()', () => {
    test('returns the entity when a matching row exists', async () => {
      await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;
      const result = await repo.findById({ id: 1 });
      expect(result).toEqual({ id: 1 as PrimaryKey<number>, name: 'Alice' });
    });

    test('returns null when no matching row exists', async () => {
      const result = await repo.findById({ id: 999 });
      expect(result).toBeNull();
    });
  });

  describe('findMany()', () => {
    test('returns all rows from the table', async () => {
      await sql`INSERT INTO test_entity (name) VALUES ('Alice')`;
      await sql`INSERT INTO test_entity (name) VALUES ('Bob')`;
      const result = await repo.findMany();
      expect(result).toEqual([
        { id: 1 as PrimaryKey<number>, name: 'Alice' },
        { id: 2 as PrimaryKey<number>, name: 'Bob' },
      ]);
    });
  });

  describe('create()', () => {
    test('inserts a row and returns a key object containing the generated primary key', async () => {
      const created = await repo.create({ name: 'Alice' });
      expect(created).toEqual({ id: 1 as PrimaryKey<number> });

      const [row] = await sql`SELECT * FROM test_entity WHERE id = ${created.id}`;
      expect(row).toEqual({ id: 1, name: 'Alice' });
    });

    test('forwards a user-supplied value for an auto-generated primary key', async () => {
      const created = await repo.create({ id: 99, name: 'Alice' });

      expect(created).toEqual({ id: 99 as PrimaryKey<number> });

      const [row] = await sql`SELECT * FROM test_entity WHERE id = 99`;
      expect(row).toEqual({ id: 99, name: 'Alice' });
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
      await repo.delete({ id: 1 });

      const remaining = await sql`SELECT * FROM test_entity`;
      expect(remaining).toHaveLength(0);
    });
  });

  describe('create() with relations', () => {
    class Profile {
      id!: PrimaryKey<number>;
    }
    class UserWithProfile {
      id?: PrimaryKey<number>;
      name!: string;
      profile?: Profile;
    }

    const relDb = new Database();
    relDb.getMetadata().set(Profile, {
      tableName: 'profile',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
          autogeneration: { dbSide: () => undefined },
        },
      ],
      relations: [],
    });
    relDb.getMetadata().set(UserWithProfile, {
      tableName: 'user_with_profile',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
          autogeneration: { dbSide: () => undefined },
        },
        { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
      ],
      relations: [
        {
          propertyName: 'profile',
          relationType: RelationType.TO_ONE,
          nullable: false,
          columns: [{ name: 'profile_id', type: COLUMN_TYPE.INTEGER, referencedProperty: 'id' }],
          getTarget: () => Profile,
        },
      ],
    });

    let relSql: SQL;
    let userRepo: Repository<UserWithProfile>;

    beforeEach(async () => {
      relSql = new SQL({ url: 'sqlite://:memory:' });
      await relSql`CREATE TABLE profile (id INTEGER PRIMARY KEY AUTOINCREMENT)`;
      await relSql`CREATE TABLE user_with_profile (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        profile_id INTEGER
      )`;
      spyOn(relDb, 'getConnection').mockReturnValue(relSql);
      userRepo = new Repository<UserWithProfile>(UserWithProfile, relDb);
    });

    test('writes FK column from a related object with a PK', async () => {
      await relSql`INSERT INTO profile (id) VALUES (7)`;
      const created = await userRepo.create({ name: 'Alice', profile: { id: 7 as PrimaryKey<number> } });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = ${created.id}`;
      expect(row).toEqual({ id: created.id, name: 'Alice', profile_id: 7 });
    });

    test('writes NULL FK when relation property is omitted', async () => {
      const created = await userRepo.create({ name: 'Alice' });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = ${created.id}`;
      expect(row).toEqual({ id: created.id, name: 'Alice', profile_id: null });
    });

    test('writes NULL FK when relation property is explicitly undefined', async () => {
      const created = await userRepo.create({
        name: 'Alice',
        profile: undefined,
      });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = ${created.id}`;
      expect(row).toEqual({ id: created.id, name: 'Alice', profile_id: null });
    });
  });

  describe('create() with composite-FK relations', () => {
    class OrderItem {
      orderId!: PrimaryKey<number>;
      productId!: PrimaryKey<number>;
    }
    class OrderDetail {
      id?: PrimaryKey<number>;
      orderItem?: OrderItem;
    }

    const compDb = new Database();
    compDb.getMetadata().set(OrderItem, {
      tableName: 'order_item',
      columns: [
        { propertyName: 'orderId', columnName: 'orderId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'productId', columnName: 'productId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
      ],
      relations: [],
    });
    compDb.getMetadata().set(OrderDetail, {
      tableName: 'order_detail',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
          autogeneration: { dbSide: () => undefined },
        },
      ],
      relations: [
        {
          propertyName: 'orderItem',
          relationType: RelationType.TO_ONE,
          nullable: false,
          columns: [
            { name: 'orderItem_orderId', type: COLUMN_TYPE.INTEGER, referencedProperty: 'orderId' },
            { name: 'orderItem_productId', type: COLUMN_TYPE.INTEGER, referencedProperty: 'productId' },
          ],
          getTarget: () => OrderItem,
        },
      ],
    });

    let compSql: SQL;
    let detailRepo: Repository<OrderDetail>;

    beforeEach(async () => {
      compSql = new SQL({ url: 'sqlite://:memory:' });
      await compSql`CREATE TABLE order_item (
        orderId   INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        PRIMARY KEY (orderId, productId)
      )`;
      await compSql`CREATE TABLE order_detail (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        orderItem_orderId    INTEGER,
        orderItem_productId  INTEGER
      )`;
      spyOn(compDb, 'getConnection').mockReturnValue(compSql);
      detailRepo = new Repository<OrderDetail>(OrderDetail, compDb);
    });

    test('writes both FK columns from a composite-PK related object', async () => {
      await compSql`INSERT INTO order_item (orderId, productId) VALUES (1, 2)`;
      const created = await detailRepo.create({ orderItem: { orderId: 1 as PrimaryKey<number>, productId: 2 as PrimaryKey<number> } });

      const [row] = await compSql`SELECT * FROM order_detail WHERE id = ${created.id}`;
      expect(row).toEqual({
        id: created.id,
        orderItem_orderId: 1,
        orderItem_productId: 2,
      });
    });
  });

  describe('update() with relations', () => {
    class Profile {
      id!: PrimaryKey<number>;
    }
    class UserWithProfile {
      id!: PrimaryKey<number>;
      name!: string;
      profile?: Profile | null;
    }

    const relDb = new Database();
    relDb.getMetadata().set(Profile, {
      tableName: 'profile',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
        },
      ],
      relations: [],
    });
    relDb.getMetadata().set(UserWithProfile, {
      tableName: 'user_with_profile',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
        },
        { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
      ],
      relations: [
        {
          propertyName: 'profile',
          relationType: RelationType.TO_ONE,
          nullable: true,
          columns: [{ name: 'profile_id', type: COLUMN_TYPE.INTEGER, referencedProperty: 'id' }],
          getTarget: () => Profile,
        },
      ],
    });

    let relSql: SQL;
    let userRepo: Repository<UserWithProfile>;

    beforeEach(async () => {
      relSql = new SQL({ url: 'sqlite://:memory:' });
      await relSql`CREATE TABLE profile (id INTEGER PRIMARY KEY AUTOINCREMENT)`;
      await relSql`CREATE TABLE user_with_profile (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        profile_id INTEGER
      )`;
      spyOn(relDb, 'getConnection').mockReturnValue(relSql);
      userRepo = new Repository<UserWithProfile>(UserWithProfile, relDb);
    });

    test('re-points FK column to a different related object', async () => {
      await relSql`INSERT INTO profile (id) VALUES (7)`;
      await relSql`INSERT INTO profile (id) VALUES (9)`;
      await relSql`INSERT INTO user_with_profile (id, name, profile_id) VALUES (1, 'Alice', 7)`;

      await userRepo.update({ id: 1, name: 'Alice', profile: { id: 9 as PrimaryKey<number> } });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = 1`;
      expect(row).toEqual({ id: 1, name: 'Alice', profile_id: 9 });
    });

    test('clears FK column when relation is null', async () => {
      await relSql`INSERT INTO profile (id) VALUES (7)`;
      await relSql`INSERT INTO user_with_profile (id, name, profile_id) VALUES (1, 'Alice', 7)`;

      await userRepo.update({ id: 1, name: 'Alice', profile: null });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = 1`;
      expect(row).toEqual({ id: 1, name: 'Alice', profile_id: null });
    });

    test('clears FK column when relation is explicitly undefined', async () => {
      await relSql`INSERT INTO profile (id) VALUES (7)`;
      await relSql`INSERT INTO user_with_profile (id, name, profile_id) VALUES (1, 'Alice', 7)`;

      await userRepo.update({ id: 1, name: 'Alice', profile: undefined });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = 1`;
      expect(row).toEqual({ id: 1, name: 'Alice', profile_id: null });
    });
  });

  describe('update() with composite-FK relations', () => {
    class OrderItem {
      orderId!: PrimaryKey<number>;
      productId!: PrimaryKey<number>;
    }
    class OrderDetail {
      id!: PrimaryKey<number>;
      orderItem?: OrderItem;
    }

    const compDb = new Database();
    compDb.getMetadata().set(OrderItem, {
      tableName: 'order_item',
      columns: [
        { propertyName: 'orderId', columnName: 'orderId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'productId', columnName: 'productId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
      ],
      relations: [],
    });
    compDb.getMetadata().set(OrderDetail, {
      tableName: 'order_detail',
      columns: [
        { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
      ],
      relations: [
        {
          propertyName: 'orderItem',
          relationType: RelationType.TO_ONE,
          nullable: true,
          columns: [
            { name: 'orderItem_orderId', type: COLUMN_TYPE.INTEGER, referencedProperty: 'orderId' },
            { name: 'orderItem_productId', type: COLUMN_TYPE.INTEGER, referencedProperty: 'productId' },
          ],
          getTarget: () => OrderItem,
        },
      ],
    });

    let compSql: SQL;
    let detailRepo: Repository<OrderDetail>;

    beforeEach(async () => {
      compSql = new SQL({ url: 'sqlite://:memory:' });
      await compSql`CREATE TABLE order_item (
        orderId   INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        PRIMARY KEY (orderId, productId)
      )`;
      await compSql`CREATE TABLE order_detail (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        orderItem_orderId    INTEGER,
        orderItem_productId  INTEGER
      )`;
      spyOn(compDb, 'getConnection').mockReturnValue(compSql);
      detailRepo = new Repository<OrderDetail>(OrderDetail, compDb);
    });

    test('updates both FK columns together for a composite-PK related object', async () => {
      await compSql`INSERT INTO order_item (orderId, productId) VALUES (1, 2)`;
      await compSql`INSERT INTO order_item (orderId, productId) VALUES (3, 4)`;
      await compSql`INSERT INTO order_detail (id, orderItem_orderId, orderItem_productId) VALUES (1, 1, 2)`;

      await detailRepo.update({ id: 1, orderItem: { orderId: 3 as PrimaryKey<number>, productId: 4 as PrimaryKey<number> } });

      const [row] = await compSql`SELECT * FROM order_detail WHERE id = 1`;
      expect(row).toEqual({
        id: 1,
        orderItem_orderId: 3,
        orderItem_productId: 4,
      });
    });
  });

  describe('findById() with composite primary keys', () => {
    class OrderItem {
      orderId!: PrimaryKey<number>;
      productId!: PrimaryKey<number>;
      quantity!: number;
    }

    const compDb = new Database();
    compDb.getMetadata().set(OrderItem, {
      tableName: 'order_item',
      columns: [
        { propertyName: 'orderId', columnName: 'orderId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'productId', columnName: 'productId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'quantity', columnName: 'quantity', type: COLUMN_TYPE.INTEGER, nullable: false },
      ],
      relations: [],
    });

    let compSql: SQL;
    let orderItemRepo: Repository<OrderItem>;

    beforeEach(async () => {
      compSql = new SQL({ url: 'sqlite://:memory:' });
      await compSql`CREATE TABLE order_item (
        orderId   INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        quantity  INTEGER NOT NULL,
        PRIMARY KEY (orderId, productId)
      )`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 2, 10)`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 3, 20)`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (2, 2, 30)`;
      spyOn(compDb, 'getConnection').mockReturnValue(compSql);
      orderItemRepo = new Repository<OrderItem>(OrderItem, compDb);
    });

    test('returns the row matching all primary key fields', async () => {
      const result = await orderItemRepo.findById({ orderId: 1, productId: 3 });
      expect(result).toEqual({ orderId: 1 as PrimaryKey<number>, productId: 3 as PrimaryKey<number>, quantity: 20 });
    });

    test('returns null when no row matches all primary key fields', async () => {
      const result = await orderItemRepo.findById({ orderId: 1, productId: 99 });
      expect(result).toBeNull();
    });

    test('throws IncompletePrimaryKeyError when a primary key field is missing', async () => {
      await expect(
        orderItemRepo.findById({ orderId: 1 } as unknown as { orderId: number; productId: number }),
      ).rejects.toBeInstanceOf(IncompletePrimaryKeyError);
    });

    test('IncompletePrimaryKeyError lists every missing primary key field', async () => {
      try {
        await orderItemRepo.findById({} as unknown as { orderId: number; productId: number });
        throw new Error('expected findById to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(IncompletePrimaryKeyError);
        const typed = err as IncompletePrimaryKeyError;
        expect(typed.entityName).toBe('OrderItem');
        expect(typed.missingProperties).toEqual(['orderId', 'productId']);
      }
    });
  });

  describe('delete() with composite primary keys', () => {
    class OrderItem {
      orderId!: PrimaryKey<number>;
      productId!: PrimaryKey<number>;
      quantity!: number;
    }

    const compDb = new Database();
    compDb.getMetadata().set(OrderItem, {
      tableName: 'order_item',
      columns: [
        { propertyName: 'orderId', columnName: 'orderId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'productId', columnName: 'productId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'quantity', columnName: 'quantity', type: COLUMN_TYPE.INTEGER, nullable: false },
      ],
      relations: [],
    });

    let compSql: SQL;
    let orderItemRepo: Repository<OrderItem>;

    beforeEach(async () => {
      compSql = new SQL({ url: 'sqlite://:memory:' });
      await compSql`CREATE TABLE order_item (
        orderId   INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        quantity  INTEGER NOT NULL,
        PRIMARY KEY (orderId, productId)
      )`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 2, 10)`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 3, 20)`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (2, 2, 30)`;
      spyOn(compDb, 'getConnection').mockReturnValue(compSql);
      orderItemRepo = new Repository<OrderItem>(OrderItem, compDb);
    });

    test('removes only the row matching every primary key field', async () => {
      await orderItemRepo.delete({ orderId: 1, productId: 3 });

      const rows = await compSql<{ orderId: number; productId: number; quantity: number }[]>`
        SELECT * FROM order_item ORDER BY orderId, productId
      `;
      expect(rows).toEqual([
        { orderId: 1, productId: 2, quantity: 10 },
        { orderId: 2, productId: 2, quantity: 30 },
      ]);
    });

    test('removes nothing when no row matches every primary key field', async () => {
      await orderItemRepo.delete({ orderId: 1, productId: 99 });

      const rows = await compSql<{ orderId: number; productId: number }[]>`
        SELECT orderId, productId FROM order_item ORDER BY orderId, productId
      `;
      expect(rows).toHaveLength(3);
    });

    test('throws IncompletePrimaryKeyError when a primary key field is missing', async () => {
      await expect(
        orderItemRepo.delete({ orderId: 1 } as unknown as { orderId: number; productId: number }),
      ).rejects.toBeInstanceOf(IncompletePrimaryKeyError);
    });
  });

  describe('update() with composite primary keys', () => {
    class OrderItem {
      orderId!: PrimaryKey<number>;
      productId!: PrimaryKey<number>;
      quantity!: number;
    }

    const compDb = new Database();
    compDb.getMetadata().set(OrderItem, {
      tableName: 'order_item',
      columns: [
        { propertyName: 'orderId', columnName: 'orderId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'productId', columnName: 'productId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'quantity', columnName: 'quantity', type: COLUMN_TYPE.INTEGER, nullable: false },
      ],
      relations: [],
    });

    let compSql: SQL;
    let orderItemRepo: Repository<OrderItem>;

    beforeEach(async () => {
      compSql = new SQL({ url: 'sqlite://:memory:' });
      await compSql`CREATE TABLE order_item (
        orderId   INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        quantity  INTEGER NOT NULL,
        PRIMARY KEY (orderId, productId)
      )`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 2, 10)`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 3, 20)`;
      await compSql`INSERT INTO order_item (orderId, productId, quantity) VALUES (2, 2, 30)`;
      spyOn(compDb, 'getConnection').mockReturnValue(compSql);
      orderItemRepo = new Repository<OrderItem>(OrderItem, compDb);
    });

    test('mutates only the row matching every primary key field', async () => {
      await orderItemRepo.update({ orderId: 1, productId: 3, quantity: 999 });

      const rows = await compSql<{ orderId: number; productId: number; quantity: number }[]>`
        SELECT * FROM order_item ORDER BY orderId, productId
      `;
      expect(rows).toEqual([
        { orderId: 1, productId: 2, quantity: 10 },
        { orderId: 1, productId: 3, quantity: 999 },
        { orderId: 2, productId: 2, quantity: 30 },
      ]);
    });
  });

  describe('create() with composite primary keys', () => {
    class OrderItem {
      orderId!: PrimaryKey<number>;
      productId!: PrimaryKey<number>;
      quantity!: number;
    }

    const compDb = new Database();
    compDb.getMetadata().set(OrderItem, {
      tableName: 'order_item',
      columns: [
        { propertyName: 'orderId', columnName: 'orderId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'productId', columnName: 'productId', type: COLUMN_TYPE.INTEGER, primary: true, nullable: false },
        { propertyName: 'quantity', columnName: 'quantity', type: COLUMN_TYPE.INTEGER, nullable: false },
      ],
      relations: [],
    });

    let compSql: SQL;
    let orderItemRepo: Repository<OrderItem>;

    beforeEach(async () => {
      compSql = new SQL({ url: 'sqlite://:memory:' });
      await compSql`CREATE TABLE order_item (
        orderId   INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        quantity  INTEGER NOT NULL,
        PRIMARY KEY (orderId, productId)
      )`;
      spyOn(compDb, 'getConnection').mockReturnValue(compSql);
      orderItemRepo = new Repository<OrderItem>(OrderItem, compDb);
    });

    test('inserts a row using all user-provided primary key values and returns the full key object', async () => {
      const created = await orderItemRepo.create({ orderId: 1, productId: 2, quantity: 10 });

      expect(created).toEqual({ orderId: 1 as PrimaryKey<number>, productId: 2 as PrimaryKey<number> });

      const [row] = await compSql`SELECT * FROM order_item WHERE orderId = 1 AND productId = 2`;
      expect(row).toEqual({ orderId: 1, productId: 2, quantity: 10 });
    });

    test('throws IncompletePrimaryKeyError when a user-provided primary key field is missing', async () => {
      await expect(
        // @ts-expect-error productId required
        orderItemRepo.create({ orderId: 1, quantity: 10 }),
      ).rejects.toBeInstanceOf(IncompletePrimaryKeyError);
    });

    test('IncompletePrimaryKeyError lists every missing user-provided primary key field', async () => {
      try {
        // @ts-expect-error orderId and productId required
        await orderItemRepo.create({ quantity: 10 });
        throw new Error('expected create to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(IncompletePrimaryKeyError);
        const typed = err as IncompletePrimaryKeyError;
        expect(typed.entityName).toBe('OrderItem');
        expect(typed.missingProperties).toEqual(['orderId', 'productId']);
      }
    });
  });

  describe('create() with clientSide autogeneration', () => {
    class UuidEntity {
      id?: PrimaryKey<string>;
      name!: string;
    }

    let invocationCount = 0;
    const uuidDb = new Database();
    uuidDb.getMetadata().set(UuidEntity, {
      tableName: 'uuid_entity',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.UUID,
          primary: true,
          nullable: false,
          autogeneration: {
            clientSide: () => {
              invocationCount += 1;
              return `uuid-${invocationCount}`;
            },
          },
        },
        { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
      ],
      relations: [],
    });

    let uuidSql: SQL;
    let uuidRepo: Repository<UuidEntity>;

    beforeEach(async () => {
      invocationCount = 0;
      uuidSql = new SQL({ url: 'sqlite://:memory:' });
      await uuidSql`CREATE TABLE uuid_entity (
        id   TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`;
      spyOn(uuidDb, 'getConnection').mockReturnValue(uuidSql);
      uuidRepo = new Repository<UuidEntity>(UuidEntity, uuidDb);
    });

    test('invokes clientSide function and writes its return into INSERT and key', async () => {
      const key = await uuidRepo.create({ name: 'Alice' });

      expect(invocationCount).toBe(1);
      expect(key).toEqual({ id: 'uuid-1' as PrimaryKey<string> });

      const [row] = await uuidSql`SELECT * FROM uuid_entity WHERE id = ${key.id}`;
      expect(row).toEqual({ id: 'uuid-1', name: 'Alice' });
    });

    test('explicit caller value wins over clientSide function', async () => {
      const key = await uuidRepo.create({ id: 'caller-uuid', name: 'Alice' });

      expect(invocationCount).toBe(0);
      expect(key).toEqual({ id: 'caller-uuid' as PrimaryKey<string> });

      const [row] = await uuidSql`SELECT * FROM uuid_entity WHERE id = 'caller-uuid'`;
      expect(row).toEqual({ id: 'caller-uuid', name: 'Alice' });
    });
  });

  describe('create() with dbSide autogeneration', () => {
    class SerialEntity {
      id?: PrimaryKey<number>;
      name!: string;
    }

    const serialDb = new Database();
    serialDb.getMetadata().set(SerialEntity, {
      tableName: 'serial_entity',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
          autogeneration: { dbSide: () => undefined },
        },
        { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
      ],
      relations: [],
    });

    let serialSql: SQL;
    let serialRepo: Repository<SerialEntity>;

    beforeEach(async () => {
      serialSql = new SQL({ url: 'sqlite://:memory:' });
      await serialSql`CREATE TABLE serial_entity (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )`;
      spyOn(serialDb, 'getConnection').mockReturnValue(serialSql);
      serialRepo = new Repository<SerialEntity>(SerialEntity, serialDb);
    });

    test('omits column from INSERT and reads back from RETURNING', async () => {
      const key = await serialRepo.create({ name: 'Alice' });

      expect(typeof key.id).toBe('number');
      expect(key.id).toBeGreaterThan(0);

      const [row] = await serialSql`SELECT * FROM serial_entity WHERE id = ${key.id}`;
      expect(row).toEqual({ id: key.id, name: 'Alice' });
    });
  });

  describe('create() requirePrimaryKey via autogeneration metadata', () => {
    class StrictSerial {
      id!: PrimaryKey<number>;
      name!: string;
    }

    const strictDb = new Database();
    strictDb.getMetadata().set(StrictSerial, {
      tableName: 'strict_serial',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
        },
        { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
      ],
      relations: [],
    });

    let strictSql: SQL;
    let strictRepo: Repository<StrictSerial>;

    beforeEach(async () => {
      strictSql = new SQL({ url: 'sqlite://:memory:' });
      await strictSql`CREATE TABLE strict_serial (
        id   INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`;
      spyOn(strictDb, 'getConnection').mockReturnValue(strictSql);
      strictRepo = new Repository<StrictSerial>(StrictSerial, strictDb);
    });

    test('throws IncompletePrimaryKeyError for SERIAL-typed PK without autogeneration when value omitted', async () => {
      await expect(
        // @ts-expect-error id required
        strictRepo.create({ name: 'Alice' }),
      ).rejects.toBeInstanceOf(IncompletePrimaryKeyError);
    });

    test('accepts the row when caller supplies an id for a non-autogenerating PK', async () => {
      const key = await strictRepo.create({ id: 42, name: 'Alice' });
      expect(key).toEqual({ id: 42 as PrimaryKey<number> });

      const [row] = await strictSql`SELECT * FROM strict_serial WHERE id = 42`;
      expect(row).toEqual({ id: 42, name: 'Alice' });
    });
  });

  describe('create() compile-time required-field enforcement', () => {
    const tdb = new Database();

    test('rejects missing @NotNullable non-PK field', () => {
      @Entity(tdb)
      class CompileUser {
        @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
        id!: PrimaryKey<number>;

        @Column({ type: COLUMN_TYPE.TEXT })
        @NotNullable
        name!: string;

        @Column({ type: COLUMN_TYPE.TEXT })
        @NotNullable
        email!: string;
      }

      const repo = new Repository(CompileUser, tdb);

      // @ts-expect-error email required
      void (() => repo.create({ id: 1, name: 'Alice' }));

      void (() => repo.create({ id: 1, name: 'Alice', email: 'a@b' }));
    });

    test('rejects missing required composite-PK field', () => {
      @Entity(tdb, 'ci_compile_oi')
      class CompileOrderItem {
        @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
        orderId!: PrimaryKey<number>;

        @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
        productId!: PrimaryKey<number>;

        @Column({ type: COLUMN_TYPE.INTEGER })
        @NotNullable
        quantity!: number;
      }

      const repo = new Repository(CompileOrderItem, tdb);

      // @ts-expect-error productId required
      void (() => repo.create({ orderId: 1, quantity: 10 }));

      void (() => repo.create({ orderId: 1, productId: 2, quantity: 10 }));
    });

    test('permits omitting an autogenerated PK', () => {
      @Entity(tdb, 'ci_compile_uuid')
      class CompileUuid {
        @PrimaryColumn({
          type: COLUMN_TYPE.UUID,
          autogeneration: { clientSide: () => 'uuid' },
        })
        id?: PrimaryKey<string>;

        @Column({ type: COLUMN_TYPE.TEXT })
        @NotNullable
        name!: string;
      }

      const repo = new Repository(CompileUuid, tdb);

      void (() => repo.create({ name: 'Alice' }));

      void (() => repo.create({ id: 'explicit', name: 'Alice' }));
    });
  });

  describe('findById/delete/update compile-time PK enforcement', () => {
    const tdb = new Database();

    @Entity(tdb, 'pk_user')
    class PkUser {
      @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
      id!: PrimaryKey<number>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      name!: string;
    }

    @Entity(tdb, 'pk_order_item')
    class PkOrderItem {
      @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
      orderId!: PrimaryKey<number>;

      @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
      productId!: PrimaryKey<number>;

      @Column({ type: COLUMN_TYPE.INTEGER })
      @NotNullable
      quantity!: number;
    }

    @Entity(tdb, 'pk_autogen')
    class PkAutogen {
      @PrimaryColumn({
        type: COLUMN_TYPE.UUID,
        autogeneration: { clientSide: () => 'uuid' },
      })
      id?: PrimaryKey<string>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      name!: string;
    }

    test('findById rejects empty / missing-PK / wrong-field keys', () => {
      const repo = new Repository(PkUser, tdb);
      // @ts-expect-error empty key missing id
      void (() => repo.findById({}));
      // @ts-expect-error missing id
      void (() => repo.findById({ name: 'x' }));
      void (() => repo.findById({ id: 1 }));
    });

    test('delete rejects empty / missing-PK', () => {
      const repo = new Repository(PkUser, tdb);
      // @ts-expect-error empty key missing id
      void (() => repo.delete({}));
      // @ts-expect-error missing id
      void (() => repo.delete({ name: 'x' }));
      void (() => repo.delete({ id: 1 }));
    });

    test('findById rejects missing composite-PK field', () => {
      const repo = new Repository(PkOrderItem, tdb);
      // @ts-expect-error missing productId
      void (() => repo.findById({ orderId: 1 }));
      void (() => repo.findById({ orderId: 1, productId: 2 }));
    });

    test('update rejects missing PK on autogen entity', () => {
      const repo = new Repository(PkAutogen, tdb);
      // @ts-expect-error missing id
      void (() => repo.update({ name: 'x' }));
      void (() => repo.update({ id: 'abc', name: 'x' }));
    });

    test('update accepts entity returned from findById (round-trip)', async () => {
      const roundTripDb = new Database();

      class RoundTripUser {
        id!: PrimaryKey<number>;
        name!: string;
      }

      roundTripDb.getMetadata().set(RoundTripUser, {
        tableName: 'round_trip_user',
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: COLUMN_TYPE.INTEGER,
            primary: true,
            nullable: false,
          },
          {
            propertyName: 'name',
            columnName: 'name',
            type: COLUMN_TYPE.TEXT,
            nullable: false,
          },
        ],
        relations: [],
      });

      const roundTripSql = new SQL({ url: 'sqlite://:memory:' });
      await roundTripSql`CREATE TABLE round_trip_user (
        id   INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`;
      spyOn(roundTripDb, 'getConnection').mockReturnValue(roundTripSql);

      const roundTripRepo = new Repository(RoundTripUser, roundTripDb);
      await roundTripRepo.create({ id: 1, name: 'Alice' });

      const fetched = await roundTripRepo.findById({ id: 1 });
      expect(fetched).toEqual({ id: 1 as PrimaryKey<number>, name: 'Alice' });

      await roundTripRepo.update({ ...fetched!, name: 'Bob' });

      const updated = await roundTripRepo.findById({ id: 1 });
      expect(updated).toEqual({ id: 1 as PrimaryKey<number>, name: 'Bob' });
    });

    test('update runtime defense: cast-bypassed missing PK throws IncompletePrimaryKeyError', async () => {
      const defenseDb = new Database();

      class DefenseEntity {
        id!: PrimaryKey<number>;
        name!: string;
      }

      defenseDb.getMetadata().set(DefenseEntity, {
        tableName: 'defense_entity',
        columns: [
          {
            propertyName: 'id',
            columnName: 'id',
            type: COLUMN_TYPE.INTEGER,
            primary: true,
            nullable: false,
          },
          {
            propertyName: 'name',
            columnName: 'name',
            type: COLUMN_TYPE.TEXT,
            nullable: false,
          },
        ],
        relations: [],
      });

      const defenseSql = new SQL({ url: 'sqlite://:memory:' });
      await defenseSql`CREATE TABLE defense_entity (
        id   INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`;
      spyOn(defenseDb, 'getConnection').mockReturnValue(defenseSql);

      const defenseRepo = new Repository(DefenseEntity, defenseDb);

      await expect(
        defenseRepo.update({ name: 'no-pk' } as unknown as DefenseEntity),
      ).rejects.toBeInstanceOf(IncompletePrimaryKeyError);
    });
  });
});
