import { describe, beforeEach, afterEach, test, expect } from 'bun:test';
import { Entity, Column, PrimaryColumn, Database, Repository, COLUMN_TYPE, ToOne, NotNullable, Nullable } from '../src';

const db = new Database();

@Entity(db)
class User {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;

  @ToOne({ target: () => Profile })
  @Nullable
  profile?: Profile;
}

@Entity(db)
class Profile {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  bio!: string;
}

describe('Integration: Relations CRUD', () => {
  let userRepo: Repository<User>;
  let profileRepo: Repository<Profile>;

  beforeEach(async () => {
    db.connect(process.env.DATABASE_URL);
    await db.drop();
    await db.create();
    userRepo = new Repository(User, db);
    profileRepo = new Repository(Profile, db);
  });

  afterEach(async () => {
    await db.drop();
  });

  test('create() inserts a row that can be retrieved', async () => {
    const profileId = await profileRepo.create({ bio: 'Hello world' });
    const profile = await profileRepo.findById({ id: profileId });
    await userRepo.create({ name: 'Alice', profile: profile! });
    const rows = await userRepo.findMany();
    expect(rows.length).toBe(1);
    expect(rows[0]!.name).toBe('Alice');
  });

  test('findById() returns the entity when a row exists', async () => {
    const id = await userRepo.create({ name: 'Alice' });
    const user = await userRepo.findById({ id });
    expect(user).toEqual({ id, name: 'Alice' });
  });

  test('findById() returns null when no row matches', async () => {
    const user = await userRepo.findById({ id: 999 });
    expect(user).toBeNull();
  });

  test('findMany() returns all rows', async () => {
    await userRepo.create({ name: 'Alice' });
    await userRepo.create({ name: 'Bob' });
    const users = await userRepo.findMany();
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.name)).toEqual(['Alice', 'Bob']);
  });

  test('update() changes the row identified by PK', async () => {
    const id = await userRepo.create({ name: 'Alice' });
    const user = await userRepo.findById({ id });
    if (!user) throw new Error('User not found');
    await userRepo.update({ ...user, name: 'Bob' });
    const updated = await userRepo.findById({ id: user.id });
    expect(updated).toEqual({ id: user.id, name: 'Bob' });
  });

  test('delete() removes the row with the given id', async () => {
    const id = await userRepo.create({ name: 'Alice' });
    await userRepo.delete({ id });
    const user = await userRepo.findById({ id });
    expect(user).toBeNull();
  });
});
