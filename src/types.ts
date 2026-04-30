import type { SQL } from 'bun';

import type { COLUMN_TYPE } from './core/sql-types/sql-types';

declare const __pkBrand: unique symbol;

/** Marks a primary-key field. Purely a type-level brand — erased at runtime. */
export type PrimaryKey<V> = V & { readonly [__pkBrand]: true };

/** Strips the `PrimaryKey<>` brand from a value type; passes other types through. */
export type Unbrand<V> = V extends PrimaryKey<infer U> ? U : V;

/** Constraint for primary-key fields whose declaration may be omitted (autogeneration). */
export type NullablePrimaryKey<V> = PrimaryKey<V> | undefined;

/** Strategy for producing a column's value when the caller omits it. */
export type Autogeneration<Value> =
  | { clientSide: () => Value }
  | { dbSide: (sql: SQL) => SQL.Query<unknown> | undefined };

export type ColumnOptions<Value = unknown> = {
  name?: string;
  type: COLUMN_TYPE;
  autogeneration?: Autogeneration<Value>;
};

type PKKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends PrimaryKey<unknown> ? K : never;
}[keyof T];

export type UnbrandedT<T> = { [K in keyof T]: Unbrand<T[K]> };

export type PKInput<T> = { [K in PKKeys<T>]-?: NonNullable<Unbrand<T[K]>> };

export type PKOutput<T> = { [K in PKKeys<T>]-?: NonNullable<T[K]> };
