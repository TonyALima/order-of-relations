import type { ColumnMetadata } from '../../core/metadata/metadata';
import type { PrimaryKey, NullablePrimaryKey, Autogeneration, ColumnOptions } from '../../types';
import { COLUMNS_KEY } from '../entity/entity';
import { MissingNullabilityDecoratorError } from '../nullable/nullable.errors';
import { NULLABLE_KEY, type NullableField, type NotNullableField } from '../nullable/nullable';

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
