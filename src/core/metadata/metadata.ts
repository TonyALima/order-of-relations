import { COLUMN_TYPE, toForeignKeyType } from '../sql-types/sql-types';
import type { Constructor } from '../utils/utils';
import { RelationTargetNotFoundError } from './metadata.errors';

export interface ColumnMetadata {
  propertyName: string;
  columnName: string;
  type: COLUMN_TYPE;
  primary?: boolean;
  nullable: boolean;
}

export enum RelationType {
  TO_ONE = 'to-one',
  TO_MANY = 'to-many',
}

export interface RelationMetadata {
  propertyName: string;
  relationType: RelationType;
  nullable: boolean;
  columns:
    | {
        name: string;
        type: COLUMN_TYPE;
        referencedProperty: string;
      }[]
    | null;
  getTarget: () => Constructor;
}

export interface EntityMetadata {
  tableName: string;
  discriminator?: string;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
}

export class MetadataStorage implements Iterable<[Constructor, EntityMetadata]> {
  private storage = new Map<Constructor, EntityMetadata>();
  private isMetadataResolved = false;

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
        discriminator: metadata.discriminator ?? metadata.tableName,
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

  private resolveRelations() {
    for (const [, metadata] of this.storage) {
      for (const relation of metadata.relations) {
        const targetMetadata = this.storage.get(relation.getTarget());
        if (!targetMetadata) {
          throw new RelationTargetNotFoundError(
            relation.getTarget().name,
            `${metadata.tableName}.${relation.propertyName}`,
          );
        }
        const primaryColumns = targetMetadata.columns.filter((c) => c.primary);
        if (relation.columns === null) {
          relation.columns = primaryColumns.map((pk) => ({
            name: `${relation.propertyName}_${pk.propertyName}`,
            type: toForeignKeyType(pk.type),
            referencedProperty: pk.propertyName,
          }));
        }
      }
    }
  }

  private ensureMetadataResolved() {
    if (this.isMetadataResolved) return;
    this.resolveInheritance();
    this.resolveRelations();
    this.isMetadataResolved = true;
  }

  set(target: Constructor, metadata: EntityMetadata) {
    this.storage.set(target, metadata);
    this.isMetadataResolved = false;
  }

  get(target: Constructor): EntityMetadata | undefined {
    this.ensureMetadataResolved();
    return this.storage.get(target);
  }

  [Symbol.iterator](): IterableIterator<[Constructor, EntityMetadata]> {
    this.ensureMetadataResolved();
    return this.storage[Symbol.iterator]();
  }
}
