import { Entity, Column, PrimaryColumn, NotNullable, type PrimaryKey } from '../../../src';
import { COLUMN_TYPE } from '../../../src/core/sql-types/sql-types';
import { db } from '../db';

@Entity(db)
export class User {
  @PrimaryColumn({
    type: COLUMN_TYPE.SERIAL,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  email!: string;
}
