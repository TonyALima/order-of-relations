import { expect, test, describe } from 'bun:test';
import { Database } from '../core/database';
import { COLUMN_TYPE } from '../core/sql-types';
import { Column, PrimaryColumn } from './column';
import { Entity } from './entity';

describe('@Entity / @Column decorators', () => {
  test('throws when entity has no primary column defined', () => {
    expect(() => {
      @Entity('no_pk')
      class NoPkEntity {
        @Column({ type: COLUMN_TYPE.TEXT })
        name!: string;
      }
      void NoPkEntity;
    }).toThrow('Entity "NoPkEntity" must have at least one primary column');
  });

  test('stores table, column, and relation metadata for the decorated class', () => {
    @Entity('user')
    class User {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @Column({ type: COLUMN_TYPE.TEXT })
      name!: string;
    }

    expect(Database.getInstance().getMetadata().get(User)).toEqual({
      tableName: 'user',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
        },
        {
          propertyName: 'name',
          columnName: 'name',
          type: COLUMN_TYPE.TEXT,
          primary: undefined,
        },
      ],
      relations: [],
    });
  });
});
