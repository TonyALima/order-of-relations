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
    await repo.delete({ id });
    const user = await repo.findById({ id });
    expect(user).toBeNull();
  });
});

@Entity(db, 'order_item')
class OrderItem {
  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  orderId!: number;

  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  productId!: number;

  @Column({ type: COLUMN_TYPE.INTEGER })
  @NotNullable
  quantity!: number;
}

describe('Integration: Repository CRUD with composite primary key', () => {
  let orderItemRepo: Repository<OrderItem>;

  beforeEach(async () => {
    db.connect('sqlite://:memory:');
    await db.create();
    orderItemRepo = new Repository(OrderItem, db);
  });

  afterEach(async () => {
    await db.drop();
  });

  test('findById() returns the row matching every primary key field', async () => {
    const sql = db.getConnection();
    await sql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 2, 10)`;
    await sql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 3, 20)`;

    const result = await orderItemRepo.findById({ orderId: 1, productId: 3 });
    expect(result).toEqual({ orderId: 1, productId: 3, quantity: 20 });
  });

  test('findById() returns null when no row matches every primary key field', async () => {
    const sql = db.getConnection();
    await sql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 2, 10)`;

    const result = await orderItemRepo.findById({ orderId: 1, productId: 99 });
    expect(result).toBeNull();
  });

  test('delete() removes only the row matching every primary key field', async () => {
    const sql = db.getConnection();
    await sql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 2, 10)`;
    await sql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 3, 20)`;

    await orderItemRepo.delete({ orderId: 1, productId: 3 });

    const rows = await sql<{ orderId: number; productId: number; quantity: number }[]>`
      SELECT * FROM order_item ORDER BY orderId, productId
    `;
    expect(rows).toEqual([{ orderId: 1, productId: 2, quantity: 10 }]);
  });

  test('update() mutates only the row matching every primary key field', async () => {
    const sql = db.getConnection();
    await sql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 2, 10)`;
    await sql`INSERT INTO order_item (orderId, productId, quantity) VALUES (1, 3, 20)`;

    await orderItemRepo.update({ orderId: 1, productId: 3, quantity: 999 });

    const rows = await sql<{ orderId: number; productId: number; quantity: number }[]>`
      SELECT * FROM order_item ORDER BY orderId, productId
    `;
    expect(rows).toEqual([
      { orderId: 1, productId: 2, quantity: 10 },
      { orderId: 1, productId: 3, quantity: 999 },
    ]);
  });
});
