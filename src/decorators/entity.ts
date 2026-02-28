import { metadataStorage } from "../core/metadata"

const COLUMNS_KEY = Symbol("columns")
const RELATIONS_KEY = Symbol("relations")

export { COLUMNS_KEY, RELATIONS_KEY }

export function Entity(tableName: string) {
  return function <T extends abstract new (...args: any[]) => any>(
    value: T,
    context: ClassDecoratorContext<T>
  ) {
    const columns = (context.metadata[COLUMNS_KEY] as any[]) ?? []
    const relations = (context.metadata[RELATIONS_KEY] as any[]) ?? []
    metadataStorage.set(value, { tableName, columns, relations })
  }
}
