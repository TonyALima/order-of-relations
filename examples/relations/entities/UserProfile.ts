import { Entity, Column, PrimaryColumn } from '../../../src';
import { COLUMN_TYPE } from '../../../src/core/sql-types';

@Entity()
export class UserProfile {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  bio!: string;
}
