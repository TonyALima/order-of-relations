import { SQL } from 'bun';

import { type EntityMetadata, MetadataStorage } from '../metadata/metadata';
import { getColumnTypeDefinition } from '../sql-types/sql-types';
import { sqlJoin } from '../utils/utils';
import { DatabaseNotConnectedError } from './database.errors';

export class Database {
  constructor() {
    this.metadata = new MetadataStorage();
  }

  private connection?: SQL;

  private metadata: MetadataStorage;

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
      if (metadata.discriminator && metadata.discriminator !== metadata.tableName) continue;

      type ColumnDefinition = {
        columnName: string;
        sqlType: SQL.Query<unknown>;
        notNull: boolean;
        defaultFragment?: SQL.Query<unknown>;
      };

      const columnsWithSqlTypes: ColumnDefinition[] = metadata.columns.map((c) => {
        const autogen = c.autogeneration;
        const defaultFragment =
          autogen && 'dbSide' in autogen ? autogen.dbSide(sql) : undefined;
        return {
          columnName: c.columnName,
          sqlType: getColumnTypeDefinition(sql, c.type),
          notNull: !c.nullable && !c.primary,
          defaultFragment,
        };
      });

      const relationsColumnsWithSqlTypes: ColumnDefinition[] = metadata.relations.flatMap((r) =>
        (r.columns ?? []).map((c) => ({
          columnName: c.name,
          sqlType: getColumnTypeDefinition(sql, c.type),
          notNull: !r.nullable,
        })),
      );

      const allColumnsWithSqlTypes = [...columnsWithSqlTypes, ...relationsColumnsWithSqlTypes];

      const columnsDefinitionSqlFragment = sqlJoin({
        sql,
        items: allColumnsWithSqlTypes,
        map: (col) => {
          let definition = sql`${sql(col.columnName)} ${col.sqlType}`;

          if (col.defaultFragment) {
            definition = sql`${definition} DEFAULT ${col.defaultFragment}`;
          }

          if (col.notNull) {
            definition = sql`${definition} NOT NULL`;
          }

          return definition;
        },
      });

      const primaryColumns = metadata.columns.filter((c) => c.primary);

      const primaryColumnsSqlFragment = sqlJoin({
        sql,
        items: primaryColumns,
        map: (col) => sql`${sql(col.columnName)}`,
      });

      await sql`
        CREATE TABLE ${sql(metadata.tableName)} (
          ${columnsDefinitionSqlFragment},
          PRIMARY KEY (${primaryColumnsSqlFragment})
        )
      `;

      const hasDiscriminator = metadata.discriminator !== undefined;

      if (hasDiscriminator) {
        await sql`
          ALTER TABLE ${sql(metadata.tableName)} 
          ADD COLUMN discriminator TEXT NOT NULL;
          CREATE INDEX idx_discriminator ON ${sql(metadata.tableName)}(discriminator);
        `.simple();
      }
    }
  }

  private async createRelations(): Promise<void> {
    const sql = this.getConnection();

    for (const [, metadata] of this.metadata) {
      if (metadata.relations.length === 0) continue;

      if (metadata.discriminator && metadata.discriminator !== metadata.tableName) continue;

      await sql.begin(async (tx) => {
        for (const relation of metadata.relations) {
          if (relation.columns === null) throw new Error(); // This should never happen

          const targetMetadata = this.metadata.get(relation.getTarget())!;
          const targetPrimaryColumns = targetMetadata.columns.filter((c) => c.primary);

          const targetPrimaryColumnNames = sqlJoin({
            sql,
            items: targetPrimaryColumns,
            map: (col) => sql`${sql(col.columnName)}`,
          });

          const currentTableForeignKeyColumnsNames = sqlJoin({
            sql,
            items: relation.columns,
            map: (c) => sql`${sql(c.name)}`,
          });

          await tx`
            ALTER TABLE ${sql(metadata.tableName)}
            ADD FOREIGN KEY (${currentTableForeignKeyColumnsNames})
            REFERENCES ${sql(targetMetadata.tableName)}(${targetPrimaryColumnNames})
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

    const allMetadata = Array.from(this.metadata);
    const metadataMap = new Map(allMetadata);

    const visited = new Set<object>();
    const postOrder: EntityMetadata[] = [];

    const dfs = (constructor: object, metadata: EntityMetadata) => {
      if (visited.has(constructor)) return;
      visited.add(constructor);

      for (const relation of metadata.relations) {
        const targetConstructor = relation.getTarget();
        const targetMetadata = metadataMap.get(targetConstructor);
        if (targetMetadata) dfs(targetConstructor, targetMetadata);
      }

      postOrder.push(metadata);
    };

    for (const [constructor, metadata] of allMetadata) {
      dfs(constructor, metadata);
    }

    // Reverse post-order = topological order: each table dropped before its FK targets
    for (const metadata of postOrder.reverse()) {
      await sql`DROP TABLE IF EXISTS ${sql(metadata.tableName)}`;
    }
  }
}
