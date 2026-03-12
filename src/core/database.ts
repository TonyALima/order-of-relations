import { SQL } from 'bun';

import { metadataStorage } from './metadata';
import { getColumnTypeDefinition } from './sql-types';
export class Database {
  private static connection: SQL;

  static connect(url?: string) {
    this.connection = url ? new SQL(url) : new SQL();
  }

  static getConnection(): SQL {
    if (!this.connection) {
      throw new Error('Database not connected. Call Database.connect() first.');
    }
    return this.connection;
  }

  static async create(): Promise<void> {
    const sql = this.getConnection();

    for (const [, metadata] of metadataStorage) {
      if (metadata.columns.length === 0) continue;

      const primaryColumn = metadata.columns.find((c) => c.primary);
      if (!primaryColumn) {
        throw new Error(`Entity ${metadata.tableName} must have a primary column.`);
      }
      const primaryColumnType = getColumnTypeDefinition(sql, primaryColumn.type);

      await sql`
        CREATE TABLE ${sql(metadata.tableName)}
        (${sql(primaryColumn.columnName)} ${primaryColumnType} PRIMARY KEY)
      `;

      for (const column of metadata.columns) {
        if (column.primary) continue;

        const columnType = getColumnTypeDefinition(sql, column.type);

        await sql`
          ALTER TABLE ${sql(metadata.tableName)} 
          ADD COLUMN ${sql(column.columnName)} ${columnType}
        `;
      }
    }
  }

  static async drop(): Promise<void> {
    const sql = this.getConnection();

    for (const [, metadata] of metadataStorage) {
      await sql`DROP TABLE IF EXISTS ${sql(metadata.tableName)}`;
    }
  }
}
