import type { ColumnMetadata } from '../../core/metadata/metadata';
import { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { COLUMNS_KEY } from '../entity/entity';

type ColumnOptions = { name?: string; type: COLUMN_TYPE };

export const NULLABLE_KEY = Symbol('nullable');

export function Nullable<This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, Value & (undefined extends Value ? Value : never)>,
): void {
  const map: Map<string, boolean> = ((context.metadata[NULLABLE_KEY] as Map<string, boolean>) ??=
    new Map());
  map.set(String(context.name), true);
}

export function NotNullable<This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, Value & (undefined extends Value ? never : Value)>,
): void {
  const map: Map<string, boolean> = ((context.metadata[NULLABLE_KEY] as Map<string, boolean>) ??=
    new Map());
  map.set(String(context.name), false);
}

function createColumnDecorator(options: ColumnOptions, primary?: boolean) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= []);
    columns.push({
      propertyName: String(context.name),
      columnName: options?.name ?? String(context.name),
      type: options.type,
      primary,
    });
  };
}

export function Column(options: ColumnOptions) {
  return createColumnDecorator(options);
}

export function PrimaryColumn(options: ColumnOptions) {
  return createColumnDecorator(options, true);
}
