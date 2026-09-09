import { COLUMN_TYPE, Entity, Column, PrimaryColumn, NotNullable, type PrimaryKey } from '../../../src';
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
