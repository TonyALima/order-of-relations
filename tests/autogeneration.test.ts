import { randomUUID } from 'node:crypto';
import { describe, beforeAll, afterAll, test, expect } from 'bun:test';
import {
  Database,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  COLUMN_TYPE,
  NotNullable,
  type PrimaryKey,
} from '../src';

describe('Integration: @PrimaryColumn autogeneration', () => {
  const db = new Database();

  @Entity(db, 'gen_uuid')
  class GenUuid {
    @PrimaryColumn({
      type: COLUMN_TYPE.UUID,
      autogeneration: { dbSide: (sql) => sql`gen_random_uuid()` },
    })
    id?: PrimaryKey<string>;

    @Column({ type: COLUMN_TYPE.TEXT })
    @NotNullable
    name!: string;
  }

  @Entity(db, 'serial_no_default')
  class SerialNoDefault {
    @PrimaryColumn({
      type: COLUMN_TYPE.SERIAL,
      autogeneration: { dbSide: () => undefined },
    })
    id?: PrimaryKey<number>;

    @Column({ type: COLUMN_TYPE.TEXT })
    @NotNullable
    name!: string;
  }

  @Entity(db, 'client_uuid')
  class ClientUuid {
    @PrimaryColumn({
      type: COLUMN_TYPE.UUID,
      autogeneration: { clientSide: () => randomUUID() },
    })
    id?: PrimaryKey<string>;

    @Column({ type: COLUMN_TYPE.TEXT })
    @NotNullable
    name!: string;
  }

  beforeAll(async () => {
    db.connect(process.env.DATABASE_URL);
    await db.drop();
    await db.create();
  });

  afterAll(async () => {
    await db.drop();
    await db.getConnection().close();
  });

  test('dbSide builder returning a fragment: CREATE TABLE emits DEFAULT clause', async () => {
    const meta = db.getMetadata().get(GenUuid);
    expect(meta?.tableName).toBe('gen_uuid');
    const sql = db.getConnection();
    const inserted = await sql<{ id: string; name: string }[]>`
      INSERT INTO gen_uuid (name) VALUES ('Alice') RETURNING id, name
    `;
    expect(inserted[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(inserted[0]!.name).toBe('Alice');
  });

  test('dbSide builder returning undefined: CREATE TABLE emits no DEFAULT (SERIAL case)', async () => {
    const meta = db.getMetadata().get(SerialNoDefault);
    expect(meta?.tableName).toBe('serial_no_default');
    const sql = db.getConnection();
    const inserted = await sql<{ id: number; name: string }[]>`
      INSERT INTO serial_no_default (name) VALUES ('Alice') RETURNING id, name
    `;
    expect(typeof inserted[0]!.id).toBe('number');
    expect(inserted[0]!.id).toBeGreaterThan(0);
    expect(inserted[0]!.name).toBe('Alice');
  });

  test('clientSide function: Repository.create() invokes it and writes the return into the row', async () => {
    const repo = new Repository(ClientUuid, db);
    const key = await repo.create({ name: 'Alice' });

    expect(key.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);

    const sql = db.getConnection();
    const rows = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM client_uuid WHERE id = ${key.id}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(key.id);
    expect(rows[0]!.name).toBe('Alice');
  });
});
