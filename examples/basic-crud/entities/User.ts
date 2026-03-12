import { Entity, Column, PrimaryColumn } from '../../../src';
import { COLUMN_TYPE } from '../../../src/core/sql-types';

@Entity('user')
export class User {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  name!: string;

  @Column({ type: COLUMN_TYPE.TEXT })
  email!: string;
}
