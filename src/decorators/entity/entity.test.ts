import { expect, test, describe } from 'bun:test';
import { Database } from '../../core/database/database';
import { MetadataError } from '../../core/metadata/metadata.errors';
import { OrmError } from '../../core/orm-error';
import { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { Column, PrimaryColumn, NotNullable } from '../column/column';
import { Entity } from './entity';
import { MissingPrimaryColumnError } from './entity.errors';

const db = new Database();

describe('@Entity / @Column decorators', () => {
  test('throws MissingPrimaryColumnError when entity has no primary column defined', () => {
    let caught: unknown;
    try {
      @Entity(db, 'no_pk')
      class NoPkEntity {
        @Column({ type: COLUMN_TYPE.TEXT })
        @NotNullable
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
    @Entity(db, 'user')
    class User {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      name!: string;
    }

    expect(db.getMetadata().get(User)).toEqual({
      tableName: 'user',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
        },
        {
          propertyName: 'name',
          columnName: 'name',
          type: COLUMN_TYPE.TEXT,
          primary: undefined,
          nullable: false,
        },
      ],
      relations: [],
    });
  });
});
