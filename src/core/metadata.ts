export interface ColumnMetadata {
  propertyName: string
  columnName: string
  type?: string
  primary?: boolean
}

export interface RelationMetadata {
  propertyName: string
  type: "many-to-one" | "one-to-many"
  target: Function
  inverseSide?: string
}

export interface EntityMetadata {
  tableName: string
  columns: ColumnMetadata[]
  relations: RelationMetadata[]
}

export const metadataStorage = new Map<Function, EntityMetadata>()
