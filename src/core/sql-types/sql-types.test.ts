import { test, expect, describe } from 'bun:test';
import type { SQL } from 'bun';

import { OrmError } from '../orm-error/orm-error';
import { COLUMN_TYPE, SchemaError, UnsupportedColumnTypeError, getColumnTypeDefinition } from './sql-types';

const fakeSql = {} as unknown as SQL;

describe('UnsupportedColumnTypeError', () => {
  test('instanceof chain: OrmError > SchemaError > UnsupportedColumnTypeError', () => {
    const err = new UnsupportedColumnTypeError('bogus');
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(SchemaError);
    expect(err).toBeInstanceOf(UnsupportedColumnTypeError);
  });

  test('has correct name, columnType, and message', () => {
    const err = new UnsupportedColumnTypeError('custom_type');
    expect(err.name).toBe('UnsupportedColumnTypeError');
    expect(err.columnType).toBe('custom_type');
    expect(err.message).toBe('Unsupported column type: custom_type');
  });

  test('getColumnTypeDefinition throws UnsupportedColumnTypeError for unknown type', () => {
    expect(() => getColumnTypeDefinition(fakeSql, 'bogus' as unknown as COLUMN_TYPE)).toThrow(
      UnsupportedColumnTypeError,
    );
  });

  test('thrown error carries the columnType property', () => {
    let caught: unknown;
    try {
      getColumnTypeDefinition(fakeSql, 'xyz' as unknown as COLUMN_TYPE);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(UnsupportedColumnTypeError);
    if (!(caught instanceof UnsupportedColumnTypeError)) throw caught;
    expect(caught.columnType).toBe('xyz');
  });
});
