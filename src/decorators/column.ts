import type { ColumnMetadata } from '../core/metadata';
import { COLUMNS_KEY } from './entity';

export function Column(options?: { name?: string; type?: string }) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= []);
    columns.push({
      propertyName: String(context.name),
      columnName: options?.name ?? String(context.name),
      type: options?.type ?? 'text',
    });
  };
}

export function PrimaryColumn(options?: { name?: string; type?: string }) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns: ColumnMetadata[] = ((context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= []);
    columns.push({
      propertyName: String(context.name),
      columnName: options?.name ?? String(context.name),
      type: options?.type ?? 'serial',
      primary: true,
    });
  };
}
