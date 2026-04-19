import type { ColumnMetadata } from '../../core/metadata/metadata';
import { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { COLUMNS_KEY } from '../entity/entity';
import { MissingNullabilityDecoratorError } from '../nullable/nullable.errors';
import { NULLABLE_KEY } from '../nullable/nullable';

type ColumnOptions = { name?: string; type: COLUMN_TYPE };

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
  });
}

export function Column(options: ColumnOptions) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    return registerColumn(options, context);
  };
}

export function PrimaryColumn(options: ColumnOptions) {
  return function <This, Value>(
    _value: undefined,
    context: ClassFieldDecoratorContext<This, Value & (undefined extends Value ? never : Value)>,
  ) {
    return registerColumn(options, context, true);
  };
}
