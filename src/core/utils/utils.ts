import type { SQL } from 'bun';

export type AbstractConstructor<T> = abstract new (...args: unknown[]) => T;

export type ConcreteConstructor<T> = new (...args: unknown[]) => T;

export type Constructor<T = unknown> = AbstractConstructor<T> | ConcreteConstructor<T>;

/**
 * Joins an array of items into a comma-separated SQL fragment.
 *
 * @param sql - The active SQL connection, used to compose fragments.
 * @param items - The array of items to join.
 * @param mapFn - Maps each item to a SQL fragment (e.g. a column name or `name TYPE` pair).
 * @returns A single SQL fragment with each mapped item separated by `, `.
 *
 * @example
 * // "col1, col2, col3"
 * sqlJoin(sql, columnNames, (col) => sql`${sql(col)}`)
 *
 * @example
 * // "id SERIAL, name TEXT"
 * sqlJoin(sql, columns, (col) => sql`${sql(col.columnName)} ${col.sqlType}`)
 */
export function sqlJoin<T>(
  sql: SQL,
  items: T[],
  mapFn: (item: T) => SQL.Query<unknown>,
): SQL.Query<unknown> {
  return items.reduce<SQL.Query<unknown>>(
    (acc, item, i) => (i === 0 ? mapFn(item) : sql`${acc}, ${mapFn(item)}`),
    sql``,
  );
}
