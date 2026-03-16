import { Entity, Column } from '../../../src';
import { COLUMN_TYPE } from '../../../src/core/sql-types';
import { User } from './User';

@Entity()
export class AdminUser extends User {
  @Column({ type: COLUMN_TYPE.TEXT })
  permissionLevel!: string;
}
