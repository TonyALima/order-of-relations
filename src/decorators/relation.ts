import type { RelationMetadata } from '../core/metadata';
import type { Constructor } from '../core/utils';
import { RELATIONS_KEY } from './entity';

export function ManyToOne(target: Constructor) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations: RelationMetadata[] = ((context.metadata[
      RELATIONS_KEY
    ] as RelationMetadata[]) ??= []);
    relations.push({
      propertyName: String(context.name),
      type: 'many-to-one',
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
      type: 'one-to-many',
      target,
      inverseSide,
    });
  };
}
