import { describe, beforeEach, afterEach, test, expect } from 'bun:test';
import {
  Entity,
  Column,
  PrimaryColumn,
  Database,
  Repository,
  COLUMN_TYPE,
  NotNullable,
} from '../src';

const db = new Database();

@Entity(db)
class User {
  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;
}

describe('Integration: Repository CRUD', () => {
  let repo: Repository<User>;

  beforeEach(async () => {
    db.connect('sqlite://:memory:');
    await db.create();
    repo = new Repository(User, db);
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
    const id = await repo.create({ name: 'Alice' });
    const user = await repo.findById({ id });
    expect(user).toEqual({ id, name: 'Alice' });
  });

  test('findById() returns null when no row matches', async () => {
    const user = await repo.findById({ id: 999 });
    expect(user).toBeNull();
  });

  test('findMany() returns all rows', async () => {
    await repo.create({ name: 'Alice' });
    await repo.create({ name: 'Bob' });
    const users = await repo.findMany();
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.name)).toEqual(['Alice', 'Bob']);
  });

  test('update() changes the row identified by PK', async () => {
    const id = await repo.create({ name: 'Alice' });
    const user = await repo.findById({ id });
    if (!user) throw new Error('User not found');
    await repo.update({ ...user, name: 'Bob' });
    const updated = await repo.findById({ id: user.id });
    expect(updated).toEqual({ id: user.id, name: 'Bob' });
  });

  test('delete() removes the row with the given id', async () => {
    const id = await repo.create({ name: 'Alice' });
    await repo.delete(id);
    const user = await repo.findById({ id });
    expect(user).toBeNull();
  });
});
