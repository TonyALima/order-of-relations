import { Database } from '../core/database/database';
import type { EntityMetadata } from '../core/metadata/metadata';
import { sqlJoin, type Constructor } from '../core/utils/utils';
import { InheritanceSearchType, type Condition, type Conditions, type FindOptions } from './types';
import {
  UndefinedWhereConditionError,
  InvalidLimitError,
  InvalidOffsetError,
} from './query-builder.errors';

export class QueryBuilder<T> {
  private conditions: Condition[] = [];
  private orderByClause: { column: keyof T; direction: 'ASC' | 'DESC' } | undefined;
  private limitValue: number | undefined;
  private offsetValue: number | undefined;

  constructor(
    private entity: Constructor<T>,
    private db: Database,
  ) {}

  private setSubClassesDiscriminator() {
    const meta = this.db.getMetadata().get(this.entity)!;
    const subclasses: EntityMetadata[] = [];
    for (const [t, m] of this.db.getMetadata()) {
      if (
        t === this.entity ||
        Object.prototype.isPrototypeOf.call(this.entity.prototype, t.prototype)
      ) {
        subclasses.push(m);
      }
    }

    if (meta.discriminator) {
      this.conditions.push({
        columnName: 'discriminator',
        op: 'IN',
        value: subclasses.map((s) => s.discriminator!),
      });
    }
  }

  private setConcreteClassDiscriminator() {
    const meta = this.db.getMetadata().get(this.entity)!;
    if (meta.discriminator) {
      this.conditions.push({
        columnName: 'discriminator',
        op: '=',
        value: meta.discriminator,
      });
    }
  }

  where(callback: (conditions: Conditions<T>) => (Condition | undefined)[]): this {
    const results = callback(this.buildConditionsProxy());
    const undefinedIndex = results.findIndex((c) => c == null);
    if (undefinedIndex !== -1) {
      throw new UndefinedWhereConditionError(undefinedIndex);
    }
    this.conditions = results as Condition[];
    return this;
  }

  orderBy(column: keyof T, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = { column, direction };
    return this;
  }

  limit(value: number): this {
    if (value < 0) {
      throw new InvalidLimitError(value);
    }
    this.limitValue = value;
    return this;
  }

  offset(value: number): this {
    if (value < 0) {
      throw new InvalidOffsetError(value);
    }
    this.offsetValue = value;
    return this;
  }

  applyOptions(options?: FindOptions<T>): this {
    if (options?.where) {
      this.where(options.where);
    }
    if (options?.inheritance === InheritanceSearchType.SUBCLASSES) {
      this.setSubClassesDiscriminator();
    } else if (options?.inheritance === InheritanceSearchType.ONLY) {
      this.setConcreteClassDiscriminator();
    }
    return this;
  }

  private async executeSelect(addLimit: boolean = false): Promise<T[]> {
    const meta = this.db.getMetadata().get(this.entity)!;
    const sql = this.db.getConnection();
    const tableName = sql(meta.tableName);

    const columnNames = meta.columns.map((c) => c.columnName);
    const cols = sqlJoin({ sql, items: columnNames, map: (col) => sql`${sql(col)}` });

    const whereClause = this.conditions.length === 0 ? sql`` : sql`WHERE ${this.buildWhere()}`;
    const orderByClause = this.orderByClause
      ? sql`ORDER BY ${sql(
          meta.columns.find((c) => c.propertyName === this.orderByClause!.column)!.columnName,
        )} ${this.orderByClause.direction === 'DESC' ? sql`DESC` : sql`ASC`}`
      : sql``;
    const limitClause = addLimit
      ? sql`LIMIT 1`
      : this.limitValue !== undefined
        ? sql`LIMIT ${this.limitValue}`
        : sql``;
    const offsetClause = this.offsetValue !== undefined ? sql`OFFSET ${this.offsetValue}` : sql``;

    return sql<T[]>`SELECT ${cols} FROM ${tableName} ${whereClause} ${orderByClause} ${limitClause} ${offsetClause}`;
  }

  private buildWhere() {
    const sql = this.db.getConnection();
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

    return sqlJoin({
      sql,
      items: this.conditions,
      map: (c) => {
        const col = sql(c.columnName);
        if (c.op === 'IS NULL' || c.op === 'IS NOT NULL') {
          return sql`${col} ${opFragments[c.op]}`;
        }
        if (c.op === 'IN') {
          return sql`${col} IN ${sql(c.value)}`;
        }
        return sql`${col} ${opFragments[c.op]} ${c.value}`;
      },
      separator: sql` AND `,
    });
  }

  async getMany(): Promise<T[]> {
    return this.executeSelect();
  }

  async getOne(): Promise<T | null> {
    const rows = await this.executeSelect(true);
    return rows[0] ?? null;
  }

  private buildConditionsProxy(): Conditions<T> {
    const meta = this.db.getMetadata().get(this.entity)!;
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
        in: (values) => ({ columnName: col.columnName, op: 'IN', value: values }),
      };
    }
    return proxy;
  }
}
