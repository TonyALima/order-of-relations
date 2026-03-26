import { RelationType, type RelationMetadata } from '../core/metadata';
import type { Constructor } from '../core/utils';
import { RELATIONS_KEY } from './entity';

export function ManyToOne(target: Constructor) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations: RelationMetadata[] = ((context.metadata[
      RELATIONS_KEY
    ] as RelationMetadata[]) ??= []);
    relations.push({
      propertyName: String(context.name),
      type: RelationType.MANY_TO_ONE,
      target,
    });
  };
}

export function OneToMany(target: Constructor, inverseSide: string) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations: RelationMetadata[] = ((context.metadata[
      RELATIONS_KEY
    ] as RelationMetadata[]) ??= []);
    relations.push({
      propertyName: String(context.name),
      type: RelationType.ONE_TO_MANY,
      target,
      inverseSide,
    });
  };
}
