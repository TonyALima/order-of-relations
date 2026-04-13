import { expect, test, describe } from 'bun:test';
import { MetadataStorage, RelationType } from './metadata';
import { MetadataError, RelationTargetNotFoundError } from './metadata.errors';
import { OrmError } from '../orm-error';
import { COLUMN_TYPE } from '../sql-types/sql-types';

describe('RelationTargetNotFoundError', () => {
  test('instanceof chain: OrmError > MetadataError > RelationTargetNotFoundError', () => {
    const err = new RelationTargetNotFoundError('User', 'posts.author');
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(MetadataError);
    expect(err).toBeInstanceOf(RelationTargetNotFoundError);
  });

  test('has correct name, targetName, and relationPath', () => {
    const err = new RelationTargetNotFoundError('User', 'posts.author');
    expect(err.name).toBe('RelationTargetNotFoundError');
    expect(err.targetName).toBe('User');
    expect(err.relationPath).toBe('posts.author');
  });

  test('MetadataStorage throws RelationTargetNotFoundError for unregistered relation target', () => {
    const storage = new MetadataStorage();
    class Post {}
    class UnknownTarget {}

    storage.set(Post, {
      tableName: 'posts',
      columns: [{ propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false }],
      relations: [
        {
          propertyName: 'author',
          columns: null,
          relationType: RelationType.TO_ONE,
          getTarget: () => UnknownTarget,
        },
      ],
    });

    let caught: unknown;
    try {
      storage.get(Post);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(RelationTargetNotFoundError);
    if (!(caught instanceof RelationTargetNotFoundError)) throw caught;
    expect(caught.targetName).toBe('UnknownTarget');
    expect(caught.relationPath).toBe('posts.author');
  });
});

describe('MetadataStorage', () => {
  describe('set / get', () => {
    test('get returns metadata previously stored with set', () => {
      const storage = new MetadataStorage();
      class User {}

      storage.set(User, {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [],
      });

      expect(storage.get(User)).toEqual({
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [],
        discriminator: undefined,
      });
    });

    test('get returns undefined for an unregistered constructor', () => {
      const storage = new MetadataStorage();
      class Unknown {}

      expect(storage.get(Unknown)).toBeUndefined();
    });

    test('set overwrites existing metadata for the same constructor', () => {
      const storage = new MetadataStorage();
      class User {}

      storage.set(User, { tableName: 'old_users', columns: [], relations: [] });
      storage.set(User, { tableName: 'users', columns: [], relations: [] });

      expect(storage.get(User)?.tableName).toBe('users');
    });
  });

  describe('[Symbol.iterator]', () => {
    test('yields all stored entries', () => {
      const storage = new MetadataStorage();
      class User {}
      class Post {}

      storage.set(User, { tableName: 'users', columns: [], relations: [] });
      storage.set(Post, { tableName: 'posts', columns: [], relations: [] });

      const entries = [...storage];

      expect(entries).toHaveLength(2);
      const keys = entries.map(([ctor]) => ctor);
      expect(keys).toContain(User);
      expect(keys).toContain(Post);
    });

    test('triggers inheritance resolution', () => {
      const storage = new MetadataStorage();
      class User {}
      class AdminUser extends User {}

      storage.set(User, { tableName: 'users', columns: [], relations: [] });
      storage.set(AdminUser, { tableName: 'admin_users', columns: [], relations: [] });

      const entries = [...storage];

      const userEntry = entries.find(([ctor]) => ctor === User);
      const adminEntry = entries.find(([ctor]) => ctor === AdminUser);

      expect(userEntry?.[1].tableName).toBe('users');
      expect(userEntry?.[1].discriminator).toBe('users');
      expect(adminEntry?.[1].tableName).toBe('users');
      expect(adminEntry?.[1].discriminator).toBe('admin_users');
    });
  });

  describe('single-table inheritance resolution', () => {
    test('child uses parent table name; both get discriminator', () => {
      const storage = new MetadataStorage();
      class User {}
      class AdminUser extends User {}

      storage.set(User, { tableName: 'users', columns: [], relations: [] });
      storage.set(AdminUser, { tableName: 'admin_users', columns: [], relations: [] });

      const userMeta = storage.get(User);
      const adminMeta = storage.get(AdminUser);

      expect(userMeta?.tableName).toBe('users');
      expect(adminMeta?.tableName).toBe('users');
      expect(userMeta?.discriminator).toBe('users');
      expect(adminMeta?.discriminator).toBe('admin_users');
    });

    test('grandchild uses grandparent table name in multi-level hierarchy', () => {
      const storage = new MetadataStorage();
      class Base {}
      class User extends Base {}
      class AdminUser extends User {}

      storage.set(Base, { tableName: 'base_entities', columns: [], relations: [] });
      storage.set(User, { tableName: 'users', columns: [], relations: [] });
      storage.set(AdminUser, { tableName: 'admin_users', columns: [], relations: [] });

      expect(storage.get(Base)?.tableName).toBe('base_entities');
      expect(storage.get(User)?.tableName).toBe('base_entities');
      expect(storage.get(AdminUser)?.tableName).toBe('base_entities');

      expect(storage.get(Base)?.discriminator).toBe('base_entities');
      expect(storage.get(User)?.discriminator).toBe('users');
      expect(storage.get(AdminUser)?.discriminator).toBe('admin_users');
    });

    test('does not set discriminator when no inheritance is detected', () => {
      const storage = new MetadataStorage();
      class User {}

      storage.set(User, { tableName: 'users', columns: [], relations: [] });

      const meta = storage.get(User);
      expect(meta?.tableName).toBe('users');
      expect(meta?.discriminator).toBeUndefined();
    });

    test('resolves inheritance only once (lazy evaluation)', () => {
      const storage = new MetadataStorage();
      class User {}

      storage.set(User, { tableName: 'users', columns: [], relations: [] });

      const first = storage.get(User);
      const second = storage.get(User);

      expect(first).toEqual(second);
      expect(first?.discriminator).toBeUndefined();
    });

    test('resolveInheritance is idempotent: re-resolving after a new entity is added does not corrupt discriminator', () => {
      const storage = new MetadataStorage();
      class Animal {}
      class Dog extends Animal {}

      storage.set(Animal, { tableName: 'animals', columns: [], relations: [] });
      storage.set(Dog, { tableName: 'dogs', columns: [], relations: [] });

      const beforeSnapshot = structuredClone(storage.get(Dog));

      class Cat {}
      storage.set(Cat, { tableName: 'cats', columns: [], relations: [] });

      const afterSnapshot = storage.get(Dog);

      expect(afterSnapshot).toEqual(beforeSnapshot);
    });
  });

  describe('relation resolution', () => {
    test('resolves columnTypes from target primary column on get()', () => {
      const storage = new MetadataStorage();
      class User {}
      class Post {}

      storage.set(User, {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [],
      });

      storage.set(Post, {
        tableName: 'posts',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [
          {
            propertyName: 'user',
            columns: [{ name: 'user_id', type: COLUMN_TYPE.INTEGER }],
            relationType: RelationType.TO_ONE,
            getTarget: () => User,
          },
        ],
      });

      const postMeta = storage.get(Post);
      expect(postMeta?.relations[0]?.columns).toEqual([
        { name: 'user_id', type: COLUMN_TYPE.INTEGER },
      ]);
    });

    test('resolves null columnNames from target PK property name on get()', () => {
      const storage = new MetadataStorage();
      class Category {}
      class Article {}

      storage.set(Category, {
        tableName: 'categories',
        columns: [
          {
            propertyName: 'categoryId',
            columnName: 'category_id',
            type: COLUMN_TYPE.SERIAL,
            primary: true,
            nullable: false,
          },
        ],
        relations: [],
      });

      storage.set(Article, {
        tableName: 'articles',
        columns: [],
        relations: [
          {
            propertyName: 'category',
            columns: null,
            relationType: RelationType.TO_ONE,
            getTarget: () => Category,
          },
        ],
      });

      const articleMeta = storage.get(Article);
      expect(articleMeta?.relations[0]?.columns).toEqual([
        { name: 'category_categoryId', type: COLUMN_TYPE.INTEGER },
      ]);
    });

    test('resolves columnNames and columnTypes as arrays for composite PK target', () => {
      const storage = new MetadataStorage();

      class OrderItem {}
      class Order {}

      storage.set(OrderItem, {
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

      storage.set(Order, {
        tableName: 'orders',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [
          {
            propertyName: 'item',
            columns: null,
            relationType: RelationType.TO_ONE,
            getTarget: () => OrderItem,
          },
        ],
      });

      const metadata = storage.get(Order)!;
      const relation = metadata.relations[0]!;

      expect(relation.columns).toEqual([
        { name: 'item_orderId', type: COLUMN_TYPE.INTEGER },
        { name: 'item_productId', type: COLUMN_TYPE.INTEGER },
      ]);
    });

    test('resolveRelations is idempotent: re-resolving after a new entity is added does not corrupt already-resolved columnNames and columnTypes', () => {
      const storage = new MetadataStorage();
      class User {}
      class Post {}

      storage.set(User, {
        tableName: 'users',
        columns: [
          { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        ],
        relations: [],
      });

      storage.set(Post, {
        tableName: 'posts',
        columns: [],
        relations: [
          {
            propertyName: 'user',
            columns: null,
            relationType: RelationType.TO_ONE,
            getTarget: () => User,
          },
        ],
      });

      const snapshotRelations = (meta: ReturnType<typeof storage.get>) =>
        meta?.relations.map(({ propertyName, columns, relationType }) => ({
          propertyName,
          columns,
          relationType,
        }));

      const beforeSnapshot = snapshotRelations(storage.get(Post));

      class Tag {}
      storage.set(Tag, { tableName: 'tags', columns: [], relations: [] });

      const afterSnapshot = snapshotRelations(storage.get(Post));

      expect(afterSnapshot).toEqual(beforeSnapshot);
    });
  });
});
