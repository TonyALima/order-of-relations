import { Entity, Column, PrimaryColumn, NotNullable } from '../../../src';
import { COLUMN_TYPE } from '../../../src/core/sql-types/sql-types';
import { db } from '../db';

@Entity(db)
export class User {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  email!: string;
}
