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
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
}

export class MetadataStorage implements Iterable<[Constructor, EntityMetadata]> {
  private storage = new Map<Constructor, EntityMetadata>();
  private isResolved = false;

  private resolve() {}

  private ensureResolved() {
    if (this.isResolved) return;
    this.resolve();
    this.isResolved = true;
  }

  set(target: Constructor, metadata: EntityMetadata) {
    this.storage.set(target, metadata);
  }

  get(target: Constructor): EntityMetadata | undefined {
    this.ensureResolved();
    return this.storage.get(target);
  }

  [Symbol.iterator](): IterableIterator<[Constructor, EntityMetadata]> {
    this.ensureResolved();
    return this.storage[Symbol.iterator]();
  }
}

export const metadataStorage = new MetadataStorage();
