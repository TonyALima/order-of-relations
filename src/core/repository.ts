import { Database } from './database';
import { metadataStorage } from './metadata';

export class Repository<T, PK extends keyof T = 'id' extends keyof T ? 'id' : never> {
  constructor(private entity: new () => T) {}

  async findOne(id: T[PK]): Promise<T | null> {
    const meta = metadataStorage.get(this.entity)!;
    const sql = Database.getConnection();
    const tableName = sql(meta.tableName);
    const primaryColumn = meta.columns.find((c) => c.primary)!;

    const row = await sql<T[]>`
      SELECT * FROM ${tableName} 
      WHERE ${sql(primaryColumn.columnName)} = ${id}
    `;
    return row[0] || null;
  }

  async findAll(): Promise<T[]> {
    const meta = metadataStorage.get(this.entity)!;
    const sql = Database.getConnection();
    const tableName = sql(meta.tableName);
    const rows = await sql<T[]>`SELECT * FROM ${tableName}`;
    return rows;
  }

  async create(entity: Omit<T, PK>): Promise<T[PK]> {
    const meta = metadataStorage.get(this.entity)!;
    const sql = Database.getConnection();

    const primaryColumn = meta.columns.find((c) => c.primary)!;
    const columns = meta.columns.filter((c) => !c.primary);
    const tableName = sql(meta.tableName);

    const objectToInsert: Record<string, unknown> = {};

    columns.forEach((col) => {
      const columnName = col.columnName;
      const propertyName = col.propertyName as keyof Omit<T, PK>;
      objectToInsert[columnName] = entity[propertyName];
    });

    const result = await sql<Record<string, T[PK]>[]>`
      INSERT INTO ${tableName} ${sql(objectToInsert)}
      RETURNING ${sql(primaryColumn.columnName)}
      `;
    return result[0]![primaryColumn.columnName]!;
  }

  async update(entity: T): Promise<void> {
    const meta = metadataStorage.get(this.entity)!;
    const sql = Database.getConnection();

    const primaryColumn = meta.columns.find((c) => c.primary)!;
    const columns = meta.columns.filter((c) => !c.primary);
    const tableName = sql(meta.tableName);

    const objectToUpdate: Record<string, unknown> = {};
    columns.forEach((col) => {
      const columnName = col.columnName;
      const propertyName = col.propertyName as keyof T;
      objectToUpdate[columnName] = entity[propertyName];
    });

    const primaryKeyValue = entity[primaryColumn.propertyName as PK];

    await sql`
      UPDATE ${tableName}
      SET ${sql(objectToUpdate)}
      WHERE ${sql(primaryColumn.columnName)} = ${primaryKeyValue}
    `;
  }
}
