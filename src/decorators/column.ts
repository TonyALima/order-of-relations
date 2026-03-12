import type { ColumnMetadata } from '../core/metadata';
import { COLUMN_TYPE } from '../core/sql-types';
import { COLUMNS_KEY } from './entity';

export function Column(options?: { name?: string; type?: COLUMN_TYPE }) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= []);
    columns.push({
      propertyName: String(context.name),
      columnName: options?.name ?? String(context.name),
      type: options?.type ?? COLUMN_TYPE.TEXT,
    });
  };
}

export function PrimaryColumn(options?: { name?: string; type?: COLUMN_TYPE }) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= []);
    columns.push({
      propertyName: String(context.name),
      columnName: options?.name ?? String(context.name),
      type: options?.type ?? COLUMN_TYPE.SERIAL,
      primary: true,
    });
  };
}
