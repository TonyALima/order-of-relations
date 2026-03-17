import { Database } from '../core/database';
import type { Constructor } from '../core/utils';
import type { Condition, Conditions, FindOptions } from './types';

export class QueryBuilder<T> {
  private conditions: Condition[] = [];

  constructor(private entity: Constructor<T>) {}

  applyOptions(options?: FindOptions<T>): this {
    if (options?.where) {
      const results = options.where(this.buildConditionsProxy());
      const undefinedIndex = results.findIndex((c) => c == null);
      if (undefinedIndex !== -1) {
        throw new Error(
          `where() condition at index ${undefinedIndex} is undefined. ` +
            'Make sure every field you access in the where callback has a @Column decorator.',
        );
      }
      this.conditions = results as Condition[];
    }
    return this;
  }

  async getMany(): Promise<T[]> {
    const db = Database.getInstance();
    const meta = db.getMetadata().get(this.entity)!;
    const sql = db.getConnection();
    const tableName = sql(meta.tableName);

    if (this.conditions.length === 0) {
      return sql<T[]>`SELECT * FROM ${tableName}`;
    }

    const opFragments = {
      '=': sql`=`,
      '!=': sql`!=`,
      '>': sql`>`,
      '>=': sql`>=`,
      '<': sql`<`,
      '<=': sql`<=`,
      'IS NULL': sql`IS NULL`,
      'IS NOT NULL': sql`IS NOT NULL`,
    };

    const fragments = this.conditions.map((c) => {
      const col = sql(c.columnName);
      const op = opFragments[c.op];
      if (c.op === 'IS NULL' || c.op === 'IS NOT NULL') {
        return sql`${col} ${op}`;
      }
      return sql`${col} ${op} ${c.value}`;
    });

    const whereClause = fragments.reduce((acc, frag) => sql`${acc} AND ${frag}`);

    return sql<T[]>`SELECT * FROM ${tableName} WHERE ${whereClause}`;
  }

  async getOne(): Promise<T | null> {
    const rows = await this.getMany();
    return rows[0] ?? null;
  }

  private buildConditionsProxy(): Conditions<T> {
    const db = Database.getInstance();
    const meta = db.getMetadata().get(this.entity)!;
    const proxy: Conditions<T> = {};
    for (const col of meta.columns) {
      proxy[col.propertyName as keyof T] = {
        eq: (value) => ({ columnName: col.columnName, op: '=', value }),
        ne: (value) => ({ columnName: col.columnName, op: '!=', value }),
        gt: (value) => ({ columnName: col.columnName, op: '>', value }),
        gte: (value) => ({ columnName: col.columnName, op: '>=', value }),
        lt: (value) => ({ columnName: col.columnName, op: '<', value }),
        lte: (value) => ({ columnName: col.columnName, op: '<=', value }),
        isNull: () => ({ columnName: col.columnName, op: 'IS NULL' }),
        isNotNull: () => ({ columnName: col.columnName, op: 'IS NOT NULL' }),
      };
    }
    return proxy;
  }
}
