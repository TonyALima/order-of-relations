import { Entity, Column, PrimaryColumn, ToOne } from '../../../src';
import { COLUMN_TYPE } from '../../../src/core/sql-types';
import { UserProfile } from './UserProfile';

@Entity()
export class User {
  @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
  id!: number;

  @Column({ type: COLUMN_TYPE.TEXT })
  name!: string;

  @Column({ type: COLUMN_TYPE.TEXT })
  email!: string;

  @Column({ type: COLUMN_TYPE.INTEGER })
  profileId!: number;

  @ToOne({ attribute: 'profileId', target: () => UserProfile })
  profile?: UserProfile;
}
