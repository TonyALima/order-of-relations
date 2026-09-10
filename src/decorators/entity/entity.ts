import { Database } from '../../core/database/database';
import type { ColumnMetadata, RelationMetadata } from '../../core/metadata/metadata';
import type { Constructor } from '../../core/utils/utils';
import { MissingPrimaryColumnError } from './entity.errors';
import { MissingNullabilityDecoratorError } from '../nullable/nullable.errors';
import { NULLABLE_KEY } from '../nullable/nullable';

const COLUMNS_KEY = Symbol('columns');
const RELATIONS_KEY = Symbol('relations');

export { COLUMNS_KEY, RELATIONS_KEY };

export function Entity(db: Database, mapTableName?: string) {
  return function <T extends Constructor>(value: T, context: ClassDecoratorContext<T>) {
    const tableName = mapTableName ?? String(context.name);
    const columns = (context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ?? [];
    const relations = (context.metadata[RELATIONS_KEY] as RelationMetadata[]) ?? [];
    const nullable = context.metadata[NULLABLE_KEY] as Map<string, boolean> | undefined;

    const getNullable = (decoratorName: 'Column' | 'ToOne', propertyName: string) => {
      const value = nullable?.get(propertyName);
      if (value === undefined) {
        throw new MissingNullabilityDecoratorError(decoratorName, propertyName);
      }
      return value;
    };

    if (!columns.some((c) => c.primary)) {
      throw new MissingPrimaryColumnError(String(context.name));
    }

    db.getMetadata().set(value, {
      tableName,
      columns: columns.map((column) => ({
        ...column,
        nullable: column.primary ? false : getNullable('Column', column.propertyName),
      })),
      relations: relations.map((relation) => ({
        ...relation,
        nullable: getNullable('ToOne', relation.propertyName),
      })),
    });
  };
}
