import { metadataStorage, type ColumnMetadata, type RelationMetadata } from "./metadata"

const COLUMNS_KEY = Symbol("columns")
const RELATIONS_KEY = Symbol("relations")

// Polyfill Symbol.metadata if not available
;(Symbol as any).metadata ??= Symbol("Symbol.metadata")

function getColumns(metadata: DecoratorMetadataObject): ColumnMetadata[] {
  return ((metadata[COLUMNS_KEY] as ColumnMetadata[]) ??= [])
}

function getRelations(metadata: DecoratorMetadataObject): RelationMetadata[] {
  return ((metadata[RELATIONS_KEY] as RelationMetadata[]) ??= [])
}

export function Entity(tableName: string) {
  return function <T extends abstract new (...args: any[]) => any>(
    value: T,
    context: ClassDecoratorContext<T>
  ) {
    const columns = getColumns(context.metadata)
    const relations = getRelations(context.metadata)
    metadataStorage.set(value, { tableName, columns, relations })
  }
}

export function Column(columnName?: { name: string }) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns = getColumns(context.metadata)
    columns.push({
      propertyName: String(context.name),
      columnName: columnName?.name || String(context.name),
    })
  }
}

export function PrimaryColumn(columnName?: string) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const columns = getColumns(context.metadata)
    columns.push({
      propertyName: String(context.name),
      columnName: columnName || String(context.name),
      primary: true,
    })
  }
}

export function ManyToOne(target: Function) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations = getRelations(context.metadata)
    relations.push({
      propertyName: String(context.name),
      type: "many-to-one",
      target,
    })
  }
}

export function OneToMany(target: Function, inverseSide: string) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const relations = getRelations(context.metadata)
    relations.push({
      propertyName: String(context.name),
      type: "one-to-many",
      target,
      inverseSide,
    })
  }
}
