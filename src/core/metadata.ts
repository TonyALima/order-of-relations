export interface ColumnMetadata {
  propertyName: string
  columnName: string
  type?: string
  primary?: boolean
}

export type Constructor<T = unknown> = (new (...args: unknown[]) => T) | (abstract new (...args: unknown[]) => T)

export interface RelationMetadata {
  propertyName: string
  type: "many-to-one" | "one-to-many"
  target: Constructor
  inverseSide?: string
}

export interface EntityMetadata {
  tableName: string
  columns: ColumnMetadata[]
  relations: RelationMetadata[]
}

export const metadataStorage = new Map<Constructor, EntityMetadata>()
