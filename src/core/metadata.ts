import type { COLUMN_TYPE } from './sql-types';

export interface ColumnMetadata {
  propertyName: string;
  columnName: string;
  type: COLUMN_TYPE;
  primary?: boolean;
}

export type Constructor<T = unknown> =
  | (new (...args: unknown[]) => T)
  | (abstract new (...args: unknown[]) => T);

export interface RelationMetadata {
  propertyName: string;
  type: 'many-to-one' | 'one-to-many';
  target: Constructor;
  inverseSide?: string;
}

export interface EntityMetadata {
  tableName: string;
  discriminator?: string;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
}

export class MetadataStorage implements Iterable<[Constructor, EntityMetadata]> {
  private storage = new Map<Constructor, EntityMetadata>();
  private isInheritanceResolved = false;

  private getParentTableName(target: Constructor): string | undefined {
    const parent = Object.getPrototypeOf(target.prototype)?.constructor;
    if (!parent || parent === Object) return undefined;

    const parentTableName = this.getParentTableName(parent);

    if (parentTableName) return parentTableName;

    const parentMetadata = this.storage.get(parent);

    return parentMetadata?.tableName;
  }

  private resolveInheritance() {
    const tableNameCount = new Map<string, number>();
    for (const [target, metadata] of this.storage) {
      const parentTableName = this.getParentTableName(target);

      const tableName = parentTableName ?? metadata.tableName;

      tableNameCount.set(tableName, (tableNameCount.get(tableName) ?? 0) + 1);

      this.storage.set(target, {
        ...metadata,
        tableName: tableName,
        discriminator: metadata.tableName,
      });
    }

    for (const [target, metadata] of this.storage) {
      if (tableNameCount.get(metadata.tableName) === 1) {
        this.storage.set(target, {
          ...metadata,
          discriminator: undefined,
        });
      }
    }
  }

  private ensureInheritanceResolved() {
    if (this.isInheritanceResolved) return;
    this.resolveInheritance();
    this.isInheritanceResolved = true;
  }

  set(target: Constructor, metadata: EntityMetadata) {
    this.storage.set(target, metadata);
  }

  get(target: Constructor): EntityMetadata | undefined {
    this.ensureInheritanceResolved();
    return this.storage.get(target);
  }

  [Symbol.iterator](): IterableIterator<[Constructor, EntityMetadata]> {
    this.ensureInheritanceResolved();
    return this.storage[Symbol.iterator]();
  }
}
