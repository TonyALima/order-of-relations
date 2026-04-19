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
    { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
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
        { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
      ],
      relations: [],
    });
    relDb.getMetadata().set(UserWithProfile, {
      tableName: 'user_with_profile',
      columns: [
        { propertyName: 'id', columnName: 'id', type: COLUMN_TYPE.SERIAL, primary: true, nullable: false },
        { propertyName: 'name', columnName: 'name', type: COLUMN_TYPE.TEXT, nullable: false },
      ],
      relations: [
        {
          propertyName: 'profile',
          relationType: RelationType.TO_ONE,
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
  });
});
