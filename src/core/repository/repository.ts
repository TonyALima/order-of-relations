import { Database } from '../database/database';
import { QueryBuilder } from '../../query-builder/query-builder';
import type { FindOptions } from '../../query-builder/types';
import { IncompletePrimaryKeyError } from './repository.errors';

export class Repository<T, PK extends keyof T = 'id' extends keyof T ? 'id' : never> {
  constructor(private entity: new () => T, private db: Database) {}

  async findMany(options?: FindOptions<T>): Promise<T[]> {
    return new QueryBuilder<T>(this.entity, this.db).applyOptions(options).getMany();
  }

  async findOne(options?: FindOptions<T>): Promise<T | null> {
    return new QueryBuilder<T>(this.entity, this.db).applyOptions(options).getOne();
  }

  async findById(key: Partial<T>): Promise<T | null> {
    const meta = this.db.getMetadata().get(this.entity)!;
    const primaryColumns = meta.columns.filter((c) => c.primary);

    const missing = primaryColumns
      .map((pc) => pc.propertyName)
      .filter((prop) => !(prop in key));
    if (missing.length > 0) {
      throw new IncompletePrimaryKeyError(this.entity.name, missing);
    }

    return new QueryBuilder<T>(this.entity, this.db)
      .applyOptions({
        where: (u) =>
          primaryColumns.map((pc) => {
            const prop = pc.propertyName as keyof T;
            return u[prop]?.eq(key[prop]!);
          }),
      })
      .getOne();
  }

  async create(entity: Omit<T, PK>): Promise<T[PK]> {
    const db = this.db;
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

    meta.relations.forEach((relation) => {
      const related = (entity as Record<string, unknown>)[relation.propertyName] as
        | Record<string, unknown>
        | null
        | undefined;

      relation.columns!.forEach((fk) => {
        objectToInsert[fk.name] = related == null ? null : related[fk.referencedProperty];
      });
    });

    const result = await sql<Record<string, T[PK]>[]>`
      INSERT INTO ${tableName} ${sql(objectToInsert)}
      RETURNING ${sql(primaryColumn.columnName)}
      `;
    return result[0]![primaryColumn.columnName]!;
  }

  async delete(key: Partial<T>): Promise<void> {
    const db = this.db;
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();
    const tableName = sql(meta.tableName);
    const primaryColumns = meta.columns.filter((c) => c.primary);

    const missing = primaryColumns
      .map((pc) => pc.propertyName)
      .filter((prop) => !(prop in key));
    if (missing.length > 0) {
      throw new IncompletePrimaryKeyError(this.entity.name, missing);
    }

    const whereFragments = primaryColumns.map(
      (pc) => sql`${sql(pc.columnName)} = ${key[pc.propertyName as keyof T]}`,
    );
    const whereClause = whereFragments.reduce((acc, frag) => sql`${acc} AND ${frag}`);

    await sql`
      DELETE FROM ${tableName}
      WHERE ${whereClause}
    `;
  }

  async update(entity: T): Promise<void> {
    const db = this.db;
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

    meta.relations.forEach((relation) => {
      const related = (entity as Record<string, unknown>)[relation.propertyName] as
        | Record<string, unknown>
        | null
        | undefined;

      relation.columns!.forEach((fk) => {
        objectToUpdate[fk.name] = related == null ? null : related[fk.referencedProperty];
      });
    });

    const primaryKeyValue = entity[primaryColumn.propertyName as PK];

    await sql`
      UPDATE ${tableName}
      SET ${sql(objectToUpdate)}
      WHERE ${sql(primaryColumn.columnName)} = ${primaryKeyValue}
    `;
  }
}
