import { COLUMN_TYPE, Entity, Column, NotNullable } from '../../../src';
import { User } from './User';
import { db } from '../db';

@Entity(db)
export class AdminUser extends User {
  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  permissionLevel!: string;
}
