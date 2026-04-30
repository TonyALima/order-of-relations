import { Database } from '../database/database';
import { QueryBuilder } from '../../query-builder/query-builder';
import type { FindOptions } from '../../query-builder/types';
import { IncompletePrimaryKeyError } from './repository.errors';
import { sqlJoin } from '../utils/utils';
import type { ColumnMetadata } from '../metadata/metadata';
import type { PrimaryKey } from '../../decorators/column/column';

type Unbrand<V> = V extends PrimaryKey<infer U> ? U : V;

type PKKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends PrimaryKey<unknown> ? K : never;
}[keyof T];

type UnbrandedT<T> = { [K in keyof T]: Unbrand<T[K]> };

export type PKInput<T> = { [K in PKKeys<T>]-?: NonNullable<Unbrand<T[K]>> };

export type PKOutput<T> = { [K in PKKeys<T>]-?: NonNullable<T[K]> };

export class Repository<T extends object> {
  constructor(
    private entity: new () => T,
    private db: Database,
  ) {}

  private requirePrimaryKey(
    key: PKInput<T> | UnbrandedT<T>,
    allowMissing?: (col: ColumnMetadata) => boolean,
  ): ColumnMetadata[] {
    const meta = this.db.getMetadata().get(this.entity)!;
    const primaryColumns = meta.columns.filter((c) => c.primary);
    const required = allowMissing ? primaryColumns.filter((c) => !allowMissing(c)) : primaryColumns;
    const missing = required.map((pc) => pc.propertyName).filter((prop) => !(prop in key));
    if (missing.length > 0) {
      throw new IncompletePrimaryKeyError(this.entity.name, missing);
    }
    return primaryColumns;
  }

  async findMany(options?: FindOptions<T>): Promise<T[]> {
    return new QueryBuilder<T>(this.entity, this.db).applyOptions(options).getMany();
  }

  async findOne(options?: FindOptions<T>): Promise<T | null> {
    return new QueryBuilder<T>(this.entity, this.db).applyOptions(options).getOne();
  }

  async findById(key: PKInput<T>): Promise<T | null> {
    const primaryColumns = this.requirePrimaryKey(key);

    return new QueryBuilder<T>(this.entity, this.db)
      .applyOptions({
        where: (u) =>
          primaryColumns.map((pc) => {
            const prop = pc.propertyName as keyof T;
            const pkProp = pc.propertyName as keyof PKInput<T>;
            return u[prop]?.eq(key[pkProp] as T[keyof T]);
          }),
      })
      .getOne();
  }

  /** Insert a row, returning a key with all primary-key columns populated. */
  async create(entity: UnbrandedT<T>): Promise<PKOutput<T>> {
    const db = this.db;
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();

    const primaryColumns = this.requirePrimaryKey(entity, (c) => c.autogeneration !== undefined);
    const nonPrimaryColumns = meta.columns.filter((c) => !c.primary);
    const tableName = sql(meta.tableName);

    const generatedKey: Partial<UnbrandedT<T>> = {};
    for (const col of primaryColumns) {
      const propertyName = col.propertyName as keyof UnbrandedT<T>;
      if (propertyName in entity) continue;
      const autogen = col.autogeneration;
      if (autogen && 'clientSide' in autogen) {
        generatedKey[propertyName] = autogen.clientSide() as UnbrandedT<T>[keyof UnbrandedT<T>];
      }
    }

    const objectToInsert: Record<string, unknown> = {};
    if (meta.discriminator !== undefined) {
      objectToInsert['discriminator'] = meta.discriminator;
    }

    primaryColumns.forEach((col) => {
      const propertyName = col.propertyName as keyof UnbrandedT<T>;
      if (propertyName in entity) {
        objectToInsert[col.columnName] = entity[propertyName];
      } else if (propertyName in generatedKey) {
        objectToInsert[col.columnName] = generatedKey[propertyName];
      }
    });

    nonPrimaryColumns.forEach((col) => {
      const propertyName = col.propertyName as keyof UnbrandedT<T>;
      objectToInsert[col.columnName] = entity[propertyName];
    });

    meta.relations.forEach((relation) => {
      const related = entity[relation.propertyName as keyof UnbrandedT<T>] as
        | Record<string, unknown>
        | null
        | undefined;

      relation.columns!.forEach((fk) => {
        objectToInsert[fk.name] = related == null ? null : related[fk.referencedProperty];
      });
    });

    const result = await sql<Record<string, unknown>[]>`
      INSERT INTO ${tableName} ${sql(objectToInsert)}
      RETURNING ${sqlJoin({ sql, items: primaryColumns, map: (pc) => sql`${sql(pc.columnName)}` })}
    `;

    const row = result[0]!;
    const key: Record<string, unknown> = {};
    primaryColumns.forEach((pc) => {
      key[pc.propertyName] = row[pc.columnName];
    });
    return key as PKOutput<T>;
  }

  async delete(key: PKInput<T>): Promise<void> {
    const db = this.db;
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();
    const tableName = sql(meta.tableName);
    const primaryColumns = this.requirePrimaryKey(key);

    const whereClause = sqlJoin({
      sql,
      items: primaryColumns,
      map: (pc) => sql`${sql(pc.columnName)} = ${key[pc.propertyName as keyof PKInput<T>]}`,
      separator: sql` AND `,
    });

    await sql`
      DELETE FROM ${tableName}
      WHERE ${whereClause}
    `;
  }

  async update(entity: UnbrandedT<T> & PKInput<T>): Promise<void> {
    const db = this.db;
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();
    const tableName = sql(meta.tableName);

    this.requirePrimaryKey(entity);

    const primaryColumns = meta.columns.filter((c) => c.primary);
    const columns = meta.columns.filter((c) => !c.primary);

    const objectToUpdate: Record<string, unknown> = {};
    columns.forEach((col) => {
      const columnName = col.columnName;
      const propertyName = col.propertyName as keyof UnbrandedT<T>;
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

    const whereClause = sqlJoin({
      sql,
      items: primaryColumns,
      map: (pc) => sql`${sql(pc.columnName)} = ${entity[pc.propertyName as keyof UnbrandedT<T>]}`,
      separator: sql` AND `,
    });

    await sql`
      UPDATE ${tableName}
      SET ${sql(objectToUpdate)}
      WHERE ${whereClause}
    `;
  }
}
