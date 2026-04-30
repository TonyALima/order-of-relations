import type { SQL } from 'bun';

import type { ColumnMetadata } from '../../core/metadata/metadata';
import type { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { COLUMNS_KEY } from '../entity/entity';
import { MissingNullabilityDecoratorError } from '../nullable/nullable.errors';
import { NULLABLE_KEY, type NullableField, type NotNullableField } from '../nullable/nullable';

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

function registerColumn(
  options: ColumnOptions,
  context: ClassFieldDecoratorContext,
  primary?: boolean,
) {
  const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= []);

  const nullableMap = context.metadata[NULLABLE_KEY] as Map<string, boolean> | undefined;
  const propertyName = String(context.name);
  const nullableEntry = nullableMap?.get(propertyName);

  if (!primary && nullableEntry === undefined) {
    throw new MissingNullabilityDecoratorError('Column', propertyName);
  }

  columns.push({
    propertyName,
    columnName: options?.name ?? propertyName,
    type: options.type,
    primary,
    nullable: primary ? false : nullableEntry!,
    autogeneration: options.autogeneration,
  });
}

export function Column(options: Omit<ColumnOptions, 'autogeneration'>) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    return registerColumn(options, context);
  };
}

export function PrimaryColumn<OptValue>(
  options: ColumnOptions<OptValue> & { autogeneration: Autogeneration<OptValue> },
): <This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, NullableField<Value> & NullablePrimaryKey<Value>>,
) => void;

export function PrimaryColumn<OptValue>(
  options: ColumnOptions<OptValue> & { autogeneration?: undefined },
): <This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, NotNullableField<Value> & PrimaryKey<Value>>,
) => void;

export function PrimaryColumn<OptValue>(options: ColumnOptions<OptValue>) {
  return function <This, Value>(
    _value: undefined,
    context: ClassFieldDecoratorContext<This, Value>,
  ) {
    return registerColumn(options, context, true);
  };
}
