import { describe, beforeEach, afterEach, test, expect } from 'bun:test';
import { Entity, Column, PrimaryColumn, Database, Repository, COLUMN_TYPE } from '../../src';

// SQLite does not support SERIAL via RETURNING; use INTEGER so that
// autoincrement PKs are returned correctly on create() and findMany().
@Entity()
class User {
  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  name!: string;
}

describe('Integration: Repository CRUD', () => {
  let db: Database;
  let repo: Repository<User>;

  beforeEach(async () => {
    db = Database.getInstance();
    db.connect('sqlite://:memory:');
    await db.create();
    repo = new Repository(User);
  });

  afterEach(async () => {
    await db.drop();
  });

  test('create() inserts a row that can be retrieved', async () => {
    await repo.create({ name: 'Alice' });
    const rows = await repo.findMany();
    expect(rows.length).toBe(1);
    expect(rows[0]!.name).toBe('Alice');
  });

  test('findById() returns the entity when a row exists', async () => {
    await repo.create({ name: 'Alice' });
    const rows = await repo.findMany();
    const id = rows[0]!.id;
    const user = await repo.findById(id);
    expect(user).toEqual({ id, name: 'Alice' });
  });

  test('findById() returns null when no row matches', async () => {
    const user = await repo.findById(999);
    expect(user).toBeNull();
  });

  test('findMany() returns all rows', async () => {
    await repo.create({ name: 'Alice' });
    await repo.create({ name: 'Bob' });
    const users = await repo.findMany();
    expect(users).toHaveLength(2);
    expect(users.map(u => u.name)).toEqual(['Alice', 'Bob']);
  });
});
