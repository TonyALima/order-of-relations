import { RelationType, type RelationMetadata } from '../../core/metadata/metadata';
import type { Constructor } from '../../core/utils/utils';
import { RELATIONS_KEY } from '../entity/entity';

export interface OneToOneOptions<TType> {
  target: () => Constructor<TType>;
  foreignKey?: string;
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
    const columnName = options.foreignKey ?? null;

    relations.push({
      propertyName,
      relationType: RelationType.TO_ONE,
      columnName,
      columnType: 'unresolved',
      getTarget: options.target,
    });
  };
}
