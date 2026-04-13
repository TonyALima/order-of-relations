import { describe, test, expect } from 'bun:test';
import { OrmError } from '../../core/orm-error';
import { MetadataError } from '../../core/metadata/metadata.errors';
import { MissingNullabilityDecoratorError } from './column.errors';
import { NULLABLE_KEY, Nullable, NotNullable, Column, PrimaryColumn } from './column';
import { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { Entity } from '../entity/entity';
import { Database } from '../../core/database/database';

describe('MissingNullabilityDecoratorError', () => {
  test('instanceof chain: OrmError > MetadataError > MissingNullabilityDecoratorError', () => {
    const err = new MissingNullabilityDecoratorError('email');
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(MetadataError);
    expect(err).toBeInstanceOf(MissingNullabilityDecoratorError);
  });

  test('has correct name and message', () => {
    const err = new MissingNullabilityDecoratorError('email');
    expect(err.name).toBe('MissingNullabilityDecoratorError');
    expect(err.message).toBe(
      "@Column on 'email' requires @Nullable or @NotNullable to be applied first.",
    );
  });

  test('exposes propertyName', () => {
    const err = new MissingNullabilityDecoratorError('nickname');
    expect(err.propertyName).toBe('nickname');
  });
});

describe('@Nullable', () => {
  test('stores nullable: true in context.metadata under NULLABLE_KEY', () => {
    const metadata: Record<symbol, unknown> = {};

    // Simulate decorator application
    const context = {
      metadata,
      name: 'nickname',
      kind: 'field' as const,
    } as ClassFieldDecoratorContext;

    Nullable(undefined, context);

    const nullableMap = metadata[NULLABLE_KEY] as Map<string, boolean>;
    expect(nullableMap.get('nickname')).toBe(true);
  });
});

describe('@NotNullable', () => {
  test('stores nullable: false in context.metadata under NULLABLE_KEY', () => {
    const metadata: Record<symbol, unknown> = {};

    const context = {
      metadata,
      name: 'email',
      kind: 'field' as const,
    } as ClassFieldDecoratorContext;

    NotNullable(undefined, context as ClassFieldDecoratorContext<unknown, string>);

    const nullableMap = metadata[NULLABLE_KEY] as Map<string, boolean>;
    expect(nullableMap.get('email')).toBe(false);
  });
});

const db = new Database();

describe('@Column with nullability', () => {
  test('@Column without @Nullable or @NotNullable throws MissingNullabilityDecoratorError', () => {
    let caught: unknown;
    try {
      @Entity(db, 'missing_null')
      class MissingNull {
        @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
        id!: number;

        @Column({ type: COLUMN_TYPE.TEXT })
        name!: string;
      }
      void MissingNull;
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(MissingNullabilityDecoratorError);
    if (!(caught instanceof MissingNullabilityDecoratorError)) throw caught;
    expect(caught.propertyName).toBe('name');
  });

  test('@PrimaryColumn without @Nullable or @NotNullable does not throw', () => {
    expect(() => {
      @Entity(db, 'pk_only')
      class PkOnly {
        @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
        id!: number;
      }
      void PkOnly;
    }).not.toThrow();
  });

  test('@Column with @NotNullable stores nullable: false in metadata', () => {
    @Entity(db, 'not_null_col')
    class NotNullCol {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      email!: string;
    }

    const metadata = db.getMetadata().get(NotNullCol)!;
    const emailCol = metadata.columns.find((c) => c.propertyName === 'email')!;
    expect(emailCol.nullable).toBe(false);
  });

  test('@Column with @Nullable stores nullable: true in metadata', () => {
    @Entity(db, 'null_col')
    class NullCol {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @Column({ type: COLUMN_TYPE.TEXT })
      @Nullable
      nickname?: string;
    }

    const metadata = db.getMetadata().get(NullCol)!;
    const nicknameCol = metadata.columns.find((c) => c.propertyName === 'nickname')!;
    expect(nicknameCol.nullable).toBe(true);
  });

  test('@PrimaryColumn always stores nullable: false regardless of decorators', () => {
    @Entity(db, 'pk_nullable')
    class PkNullable {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    const metadata = db.getMetadata().get(PkNullable)!;
    const idCol = metadata.columns.find((c) => c.propertyName === 'id')!;
    expect(idCol.nullable).toBe(false);
  });
});
