import { expect, test } from 'bun:test';
import { metadataStorage } from '../core/metadata';
import { COLUMN_TYPE } from '../core/sql-types';
import { Column, PrimaryColumn } from './column';
import { Entity } from './entity';

test('Entity stores table, column, and relation metadata for the decorated class', () => {
  @Entity('user')
  class User {
    @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
    id!: number;

    @Column({ type: COLUMN_TYPE.TEXT })
    name!: string;
  }

  expect(metadataStorage.get(User)).toEqual({
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
