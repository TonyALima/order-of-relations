import { Database } from '../database/database';
import { QueryBuilder } from '../../query-builder/query-builder';
import type { FindOptions } from '../../query-builder/types';

export class Repository<T, PK extends keyof T = 'id' extends keyof T ? 'id' : never> {
  constructor(private entity: new () => T) {}

  async findMany(options?: FindOptions<T>): Promise<T[]> {
    return new QueryBuilder<T>(this.entity).applyOptions(options).getMany();
  }

  async findOne(options?: FindOptions<T>): Promise<T | null> {
    return new QueryBuilder<T>(this.entity).applyOptions(options).getOne();
  }

  async findById(id: T[PK]): Promise<T | null> {
    const meta = Database.getInstance().getMetadata().get(this.entity)!;
    const primaryProp = meta.columns.find((c) => c.primary)!.propertyName as keyof T;
    return new QueryBuilder<T>(this.entity)
      .applyOptions({ where: (u) => [u[primaryProp]?.eq(id)] })
      .getOne();
  }

  async create(entity: Omit<T, PK>): Promise<T[PK]> {
    const db = Database.getInstance();
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();

    const primaryColumn = meta.columns.find((c) => c.primary)!;
    const columns = meta.columns.filter((c) => !c.primary);
    const tableName = sql(meta.tableName);

    const objectToInsert: Record<string, unknown> = {
      discriminator: meta.discriminator,
    };

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

  async delete(id: T[PK]): Promise<void> {
    const db = Database.getInstance();
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();
    const tableName = sql(meta.tableName);
    const primaryColumn = meta.columns.find((c) => c.primary)!;

    await sql`
      DELETE FROM ${tableName}
      WHERE ${sql(primaryColumn.columnName)} = ${id}
    `;
  }

  async update(entity: T): Promise<void> {
    const db = Database.getInstance();
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();

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
