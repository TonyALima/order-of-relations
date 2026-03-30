import { expect, test, describe } from 'bun:test';
import { Database } from '../../core/database/database';
import { MetadataError } from '../../core/metadata/metadata';
import { OrmError } from '../../core/orm-error/orm-error';
import { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { Column, PrimaryColumn } from '../column/column';
import { Entity, MissingPrimaryColumnError } from './entity';

describe('@Entity / @Column decorators', () => {
  test('throws MissingPrimaryColumnError when entity has no primary column defined', () => {
    let caught: unknown;
    try {
      @Entity('no_pk')
      class NoPkEntity {
        @Column({ type: COLUMN_TYPE.TEXT })
        name!: string;
      }
      void NoPkEntity;
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(MissingPrimaryColumnError);
    expect(caught).toBeInstanceOf(MetadataError);
    expect(caught).toBeInstanceOf(OrmError);
    if (!(caught instanceof MissingPrimaryColumnError)) throw caught;
    expect(caught.entityName).toBe('NoPkEntity');
    expect(caught.message).toBe('Entity "NoPkEntity" must have at least one primary column');
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
