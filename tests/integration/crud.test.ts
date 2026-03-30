import { describe, beforeEach, afterEach } from 'bun:test';
import { Entity, Column, PrimaryColumn, Database, Repository } from '../../src';
import { COLUMN_TYPE } from '../../src/core/sql-types/sql-types';

@Entity()
class User {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  name!: string;
}

void User;

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
