import type { SQL } from 'bun';

export type AbstractConstructor<T> = abstract new (...args: unknown[]) => T;

export type ConcreteConstructor<T> = new (...args: unknown[]) => T;

export type Constructor<T = unknown> = AbstractConstructor<T> | ConcreteConstructor<T>;

export interface SqlJoinOptions<T> {
  /** The active SQL connection, used to compose fragments. */
  sql: SQL;
  /** The array of items to join. */
  items: T[];
  /** Maps each item to a SQL fragment (e.g. a column name or `name TYPE` pair). */
  map: (item: T) => SQL.Query<unknown>;
  /** Optional SQL fragment placed between mapped items. Defaults to `sql\`, \``. */
  separator?: SQL.Query<unknown>;
}

/**
 * Joins an array of items into a single SQL fragment, separated by `separator`
 * (defaults to `, `).
 *
 * @example
 * // "col1, col2, col3"
 * sqlJoin({ sql, items: columnNames, map: (col) => sql`${sql(col)}` })
 *
 * @example
 * // "id SERIAL, name TEXT"
 * sqlJoin({
 *   sql,
 *   items: columns,
 *   map: (col) => sql`${sql(col.columnName)} ${col.sqlType}`,
 * })
 *
 * @example
 * // "orderId = 1 AND productId = 2"
 * sqlJoin({
 *   sql,
 *   items: primaryColumns,
 *   map: (pc) => sql`${sql(pc.columnName)} = ${key[pc.propertyName]}`,
 *   separator: sql` AND `,
 * })
 */
export function sqlJoin<T>({ sql, items, map, separator }: SqlJoinOptions<T>): SQL.Query<unknown> {
  const sep = separator ?? sql`, `;
  return items.reduce<SQL.Query<unknown>>(
    (acc, item, i) => (i === 0 ? map(item) : sql`${acc}${sep}${map(item)}`),
    sql``,
  );
}
