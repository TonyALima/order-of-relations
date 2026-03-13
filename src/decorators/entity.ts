import { metadataStorage, type ColumnMetadata, type RelationMetadata } from '../core/metadata';

const COLUMNS_KEY = Symbol('columns');
const RELATIONS_KEY = Symbol('relations');

export { COLUMNS_KEY, RELATIONS_KEY };

export function Entity(mapTableName?: string) {
  return function <T extends abstract new (...args: unknown[]) => unknown>(
    value: T,
    context: ClassDecoratorContext<T>,
  ) {
    const tableName = mapTableName ?? String(context.name);

    

    const columns = (context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ?? [];
    const relations = (context.metadata[RELATIONS_KEY] as RelationMetadata[]) ?? [];
    metadataStorage.set(value, { tableName, columns, relations });
  };
}
