import { RelationType, type RelationMetadata } from '../../core/metadata/metadata';
import type { Constructor } from '../../core/utils/utils';
import { RELATIONS_KEY } from '../entity/entity';

export interface ToOneOptions<TType> {
  target: () => Constructor<TType>;
}

export function ToOne<TType>(options: ToOneOptions<TType>) {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext<unknown, TType | undefined>,
  ) {
    const relations: RelationMetadata[] = ((context.metadata[
      RELATIONS_KEY
    ] as RelationMetadata[]) ??= []);

    const propertyName = context.name.toString();

    relations.push({
      propertyName,
      relationType: RelationType.TO_ONE,
      nullable: false,
      columns: null,
      getTarget: options.target,
    });
  };
}
