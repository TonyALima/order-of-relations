import type { RelationMetadata } from "../core/metadata"
import { RELATIONS_KEY } from "./entity"

export function ManyToOne(target: Function) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations: RelationMetadata[] = ((context.metadata[RELATIONS_KEY] as RelationMetadata[]) ??= [])
    relations.push({
      propertyName: String(context.name),
      type: "many-to-one",
      target,
    })
  }
}

export function OneToMany(target: Function, inverseSide: string) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations: RelationMetadata[] = ((context.metadata[RELATIONS_KEY] as RelationMetadata[]) ??= [])
    relations.push({
      propertyName: String(context.name),
      type: "one-to-many",
      target,
      inverseSide,
    })
  }
}
