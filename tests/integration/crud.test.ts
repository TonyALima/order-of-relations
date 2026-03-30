import { describe, beforeEach, afterEach } from 'bun:test';
import { Entity, Column, PrimaryColumn, Database, Repository, COLUMN_TYPE } from '../../src';

@Entity()
class User {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
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
    void repo;
    await db.drop();
  });
});
