import { RelationType, type RelationMetadata } from '../core/metadata';
import type { Constructor } from '../core/utils';
import { RELATIONS_KEY } from './entity';

export interface OneToOneOptions<TType> {
  target: () => Constructor<TType>;
}

export function ToOne<TType>(options: OneToOneOptions<TType>) {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext<unknown, TType | undefined>,
  ) {
    const relations: RelationMetadata[] = ((context.metadata[
      RELATIONS_KEY
    ] as RelationMetadata[]) ??= []);

    relations.push({
      propertyName: context.name.toString(),
      columnName: 'unresolved',
      type: RelationType.TO_ONE,
      getTarget: options.target,
    });
  };
}
