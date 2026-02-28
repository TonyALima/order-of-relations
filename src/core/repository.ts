import { metadataStorage } from "./metadata"
import { Database } from "./database"

export class Repository<T> {
  constructor(private entity: new () => T) {}

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  async findAll(): Promise<T[]> {
    const meta = metadataStorage.get(this.entity)!
    const tableName = this.quoteIdentifier(meta.tableName)
    const result = await Database.query(`SELECT * FROM ${tableName}`)
    return result.rows
  }

  async save(entity: Omit<T, "id">) {
    const meta = metadataStorage.get(this.entity)!
    const columns = meta.columns.filter(c => !c.primary)
    const tableName = this.quoteIdentifier(meta.tableName)
    const columnNames = columns.map(c => this.quoteIdentifier(c.columnName))
    const values = columns.map(c => (entity as any)[c.propertyName])
    const placeholders = values.map((_, i) => `$${i + 1}`)

    await Database.query(
      `INSERT INTO ${tableName} (${columnNames.join(",")})
       VALUES (${placeholders.join(",")})`,
      values
    )
  }
}
