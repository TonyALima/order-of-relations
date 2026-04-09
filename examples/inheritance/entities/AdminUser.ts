import { Entity, Column } from '../../../src';
import { COLUMN_TYPE } from '../../../src/core/sql-types/sql-types';
import { User } from './User';
import { db } from '../db';

@Entity(db)
export class AdminUser extends User {
  @Column({ type: COLUMN_TYPE.TEXT })
  permissionLevel!: string;
}
