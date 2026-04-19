import { RelationType, type RelationMetadata } from '../../core/metadata/metadata';
import type { Constructor } from '../../core/utils/utils';
import { RELATIONS_KEY } from '../entity/entity';
import { NULLABLE_KEY } from '../nullable/nullable';
import { MissingNullabilityDecoratorError } from '../nullable/nullable.errors';

export interface OneToOneOptions<TType> {
  target: () => Constructor<TType>;
  foreignKeys?: string[];
}

export function ToOne<TType>(options: OneToOneOptions<TType>) {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext<unknown, TType | undefined>,
  ) {
    const relations: RelationMetadata[] = ((context.metadata[
      RELATIONS_KEY
    ] as RelationMetadata[]) ??= []);

    const propertyName = context.name.toString();

    const nullableMap = context.metadata[NULLABLE_KEY] as Map<string, boolean> | undefined;
    const nullable = nullableMap?.get(propertyName);
    if (nullable === undefined) {
      throw new MissingNullabilityDecoratorError('ToOne', propertyName);
    }

    relations.push({
      propertyName,
      relationType: RelationType.TO_ONE,
      nullable,
      columns: null,
      getTarget: options.target,
    });
  };
}
