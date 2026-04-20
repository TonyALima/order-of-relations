import { test, expect, spyOn, describe, beforeEach } from 'bun:test';
import { SQL } from 'bun';
import { Repository } from './repository';
import { Database } from '../database/database';
import { COLUMN_TYPE } from '../sql-types/sql-types';
import { RelationType } from '../metadata/metadata';

class TestEntity {
  id!: number;
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
      expect(result).toEqual({ id: 1, name: 'Alice' });
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

  describe('create() with relations', () => {
    class Profile {
      id!: number;
    }
    class UserWithProfile {
      id!: number;
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
      const newId = await userRepo.create({ name: 'Alice', profile: { id: 7 } });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = ${newId}`;
      expect(row).toEqual({ id: newId, name: 'Alice', profile_id: 7 });
    });

    test('writes NULL FK when relation property is omitted', async () => {
      const newId = await userRepo.create({ name: 'Alice' } as Omit<UserWithProfile, 'id'>);

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = ${newId}`;
      expect(row).toEqual({ id: newId, name: 'Alice', profile_id: null });
    });

    test('writes NULL FK when relation property is explicitly undefined', async () => {
      const newId = await userRepo.create({
        name: 'Alice',
        profile: undefined,
      });

      const [row] = await relSql`SELECT * FROM user_with_profile WHERE id = ${newId}`;
      expect(row).toEqual({ id: newId, name: 'Alice', profile_id: null });
    });
  });

  describe('create() with composite-FK relations', () => {
    class OrderItem {
      orderId!: number;
      productId!: number;
    }
    class OrderDetail {
      id!: number;
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
      const newId = await detailRepo.create({ orderItem: { orderId: 1, productId: 2 } });

      const [row] = await compSql`SELECT * FROM order_detail WHERE id = ${newId}`;
      expect(row).toEqual({
        id: newId,
        orderItem_orderId: 1,
        orderItem_productId: 2,
      });
    });
  });

  describe('update() with relations', () => {
    class Profile {
      id!: number;
    }
    class UserWithProfile {
      id!: number;
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

      await userRepo.update({ id: 1, name: 'Alice', profile: { id: 9 } });

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
      orderId!: number;
      productId!: number;
    }
    class OrderDetail {
      id!: number;
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

      await detailRepo.update({ id: 1, orderItem: { orderId: 3, productId: 4 } });

      const [row] = await compSql`SELECT * FROM order_detail WHERE id = 1`;
      expect(row).toEqual({
        id: 1,
        orderItem_orderId: 3,
        orderItem_productId: 4,
      });
    });
  });
});
