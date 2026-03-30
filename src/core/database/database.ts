import { SQL } from 'bun';

import { MetadataStorage } from '../metadata/metadata';
import { getColumnTypeDefinition } from '../sql-types/sql-types';
import { DatabaseNotConnectedError } from './database.errors';

export class Database {
  private constructor() {
    this.metadata = new MetadataStorage();
  }

  private static instance: Database;

  private connection?: SQL;

  private metadata: MetadataStorage;

  static getInstance(): Database {
    if (!this.instance) {
      this.instance = new Database();
    }

    return this.instance;
  }

  connect(url?: string) {
    this.connection = url ? new SQL(url) : new SQL();
  }

  getConnection(): SQL {
    if (!this.connection) {
      throw new DatabaseNotConnectedError();
    }

    return this.connection;
  }

  getMetadata(): MetadataStorage {
    return this.metadata;
  }

  private async createBaseTables(): Promise<void> {
    const sql = this.getConnection();

    for (const [, metadata] of this.metadata) {
      if (metadata.columns.length === 0) continue;

      if (metadata.discriminator && metadata.discriminator !== metadata.tableName) continue;

      const primaryColumn = metadata.columns.find((c) => c.primary)!;
      const primaryColumnType = getColumnTypeDefinition(sql, primaryColumn.type);

      await sql.begin(async (tx) => {
        await tx`
          CREATE TABLE ${sql(metadata.tableName)}
          (${sql(primaryColumn.columnName)} ${primaryColumnType} PRIMARY KEY)
        `;

        const hasDiscriminator = metadata.discriminator !== undefined;

        if (hasDiscriminator) {
          await tx`
            ALTER TABLE ${sql(metadata.tableName)} 
            ADD COLUMN discriminator TEXT NOT NULL;
            CREATE INDEX idx_discriminator ON ${sql(metadata.tableName)}(discriminator);
          `.simple();
        }

        for (const column of metadata.columns) {
          if (column.primary) continue;

          const columnType = getColumnTypeDefinition(sql, column.type);

          await tx`
            ALTER TABLE ${sql(metadata.tableName)} 
            ADD COLUMN ${sql(column.columnName)} ${columnType}
          `;
        }
      });
    }
  }

  private async createRelations(): Promise<void> {
    const sql = this.getConnection();

    for (const [, metadata] of this.metadata) {
      if (metadata.relations.length === 0) continue;

      if (metadata.discriminator && metadata.discriminator !== metadata.tableName) continue;

      await sql.begin(async (tx) => {
        for (const relation of metadata.relations) {
          if (relation.columnType === 'unresolved') throw new Error(); // This should never happen
          const columnType = getColumnTypeDefinition(sql, relation.columnType);

          const targetMetadata = this.metadata.get(relation.getTarget())!;

          const targetPrimaryColumn = targetMetadata.columns.find((c) => c.primary)!;

          await tx`
            ALTER TABLE ${sql(metadata.tableName)} 
            ADD COLUMN ${sql(relation.columnName)} ${columnType} 
            REFERENCES ${sql(targetMetadata.tableName)}(${sql(targetPrimaryColumn.columnName)})
          `;
        }
      });
    }
  }

  async create(): Promise<void> {
    await this.createBaseTables();
    await this.createRelations();
  }

  async drop(): Promise<void> {
    const sql = this.getConnection();

    for (const [, metadata] of this.metadata) {
      await sql`DROP TABLE IF EXISTS ${sql(metadata.tableName)}`;
    }
  }
}
