import type { ColumnMetadata } from '../core/metadata';
import { COLUMN_TYPE } from '../core/sql-types';
import { COLUMNS_KEY } from './entity';

type ColumnOptions = { name?: string; type: COLUMN_TYPE };

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
