import { Database } from '../core/database';
import { type ColumnMetadata, type RelationMetadata } from '../core/metadata';
import type { Constructor } from '../core/utils';

const COLUMNS_KEY = Symbol('columns');
const RELATIONS_KEY = Symbol('relations');

export { COLUMNS_KEY, RELATIONS_KEY };

export function Entity(mapTableName?: string) {
  return function <T extends Constructor>(value: T, context: ClassDecoratorContext<T>) {
    const tableName = mapTableName ?? String(context.name);
    const columns = (context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ?? [];
    const relations = (context.metadata[RELATIONS_KEY] as RelationMetadata[]) ?? [];

    const EntitySubclass = class extends value {
      constructor(...args: unknown[]) {
        super(...args);
      }

      discriminator = tableName;
    };

    Database.getInstance().getMetadata().set(EntitySubclass, { tableName, columns, relations });

    return EntitySubclass;
  };
}
