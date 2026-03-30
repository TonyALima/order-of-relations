import { Database } from '../../core/database/database';
import { MetadataError, type ColumnMetadata, type RelationMetadata } from '../../core/metadata/metadata';
import type { Constructor } from '../../core/utils/utils';

export class MissingPrimaryColumnError extends MetadataError {
  constructor(readonly entityName: string) {
    super(`Entity "${entityName}" must have at least one primary column`);
  }
}

const COLUMNS_KEY = Symbol('columns');
const RELATIONS_KEY = Symbol('relations');

export { COLUMNS_KEY, RELATIONS_KEY };

export function Entity(mapTableName?: string) {
  return function <T extends Constructor>(value: T, context: ClassDecoratorContext<T>) {
    const tableName = mapTableName ?? String(context.name);
    const columns = (context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ?? [];
    const relations = (context.metadata[RELATIONS_KEY] as RelationMetadata[]) ?? [];

    if (!columns.some((c) => c.primary)) {
      throw new MissingPrimaryColumnError(String(context.name));
    }

    Database.getInstance().getMetadata().set(value, { tableName, columns, relations });
  };
}
