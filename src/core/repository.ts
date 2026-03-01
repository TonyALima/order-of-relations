import { Database } from './database';
import { metadataStorage } from './metadata';

export class Repository<T> {
  constructor(private entity: new () => T) {}

  async findAll(): Promise<T[]> {
    const meta = metadataStorage.get(this.entity)!;
    const sql = Database.getConnection();
    const tableName = sql(meta.tableName);
    const rows = await sql<T[]>`SELECT * FROM ${tableName}`;
    return rows;
  }

  async save(entity: Omit<T, 'id'>) {
    const meta = metadataStorage.get(this.entity)!;
    const sql = Database.getConnection();

    const columns = meta.columns.filter((c) => !c.primary);
    const tableName = sql(meta.tableName);

    const objectToInsert: Record<string, unknown> = {};

    columns.forEach((col) => {
      const columnName = col.columnName;
      const propertyName = col.propertyName as keyof Omit<T, 'id'>;
      objectToInsert[columnName] = entity[propertyName];
    });

    await sql`
      INSERT INTO ${tableName} ${sql(objectToInsert)}
      `;
  }
}
