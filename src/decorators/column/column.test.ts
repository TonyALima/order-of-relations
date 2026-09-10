import { describe, test, expect } from 'bun:test';
import { MissingNullabilityDecoratorError } from '../nullable/nullable.errors';
import { Nullable, NotNullable } from '../nullable/nullable';
import { Column, PrimaryColumn } from './column';
import type { PrimaryKey } from '../../types';
import { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { Entity } from '../entity/entity';
import { Database } from '../../core/database/database';

const db = new Database();

describe('@Column with nullability', () => {
  test('@Column without @Nullable or @NotNullable throws MissingNullabilityDecoratorError', () => {
    let caught: unknown;
    try {
      @Entity(db, 'missing_null')
      class MissingNull {
        @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
        id!: PrimaryKey<number>;

        @Column({ type: COLUMN_TYPE.TEXT })
        name!: string;
      }
      void MissingNull;
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(MissingNullabilityDecoratorError);
    if (!(caught instanceof MissingNullabilityDecoratorError)) throw caught;
    expect(caught.decoratorName).toBe('Column');
    expect(caught.propertyName).toBe('name');
  });

  test('@PrimaryColumn without @Nullable or @NotNullable does not throw', () => {
    expect(() => {
      @Entity(db, 'pk_only')
      class PkOnly {
        @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
        id!: PrimaryKey<number>;
      }
      void PkOnly;
    }).not.toThrow();
  });

  test('@Column stores nullable: false in metadata in either decorator order', () => {
    @Entity(db, 'not_null_col')
    class NotNullCol {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: PrimaryKey<number>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      email!: string;
    }

    const metadata = db.getMetadata().get(NotNullCol)!;
    const emailCol = metadata.columns.find((c) => c.propertyName === 'email')!;
    expect(emailCol.nullable).toBe(false);

    @Entity(db, 'not_null_col_reversed')
    class ReversedNotNullCol {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: PrimaryKey<number>;

      @NotNullable
      @Column({ type: COLUMN_TYPE.TEXT })
      email!: string;
    }

    expect(db.getMetadata().get(ReversedNotNullCol)!.columns.find((c) => c.propertyName === 'email')!.nullable).toBe(false);
  });

  test('@Column stores nullable: true in metadata in either decorator order', () => {
    @Entity(db, 'null_col')
    class NullCol {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: PrimaryKey<number>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @Nullable
      nickname?: string;
    }

    const metadata = db.getMetadata().get(NullCol)!;
    const nicknameCol = metadata.columns.find((c) => c.propertyName === 'nickname')!;
    expect(nicknameCol.nullable).toBe(true);

    @Entity(db, 'null_col_reversed')
    class ReversedNullCol {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: PrimaryKey<number>;

      @Nullable
      @Column({ type: COLUMN_TYPE.TEXT })
      nickname?: string;
    }

    expect(db.getMetadata().get(ReversedNullCol)!.columns.find((c) => c.propertyName === 'nickname')!.nullable).toBe(true);
  });

  test('@PrimaryColumn always stores nullable: false regardless of adjacent nullability decorators', () => {
    @Entity(db, 'pk_nullable')
    class PkNullable {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: PrimaryKey<number>;
    }

    const metadata = db.getMetadata().get(PkNullable)!;
    const idCol = metadata.columns.find((c) => c.propertyName === 'id')!;
    expect(idCol.nullable).toBe(false);

    @Entity(db, 'pk_with_nullable')
    class PkWithNullable {
      @Nullable
      @PrimaryColumn({
        type: COLUMN_TYPE.UUID,
        autogeneration: { clientSide: () => 'uuid' },
      })
      id?: PrimaryKey<string>;
    }

    @Entity(db, 'pk_with_not_nullable')
    class PkWithNotNullable {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      @NotNullable
      id!: PrimaryKey<number>;
    }

    expect(db.getMetadata().get(PkWithNullable)!.columns[0]!.nullable).toBe(false);
    expect(db.getMetadata().get(PkWithNotNullable)!.columns[0]!.nullable).toBe(false);
  });
});

describe('@PrimaryColumn autogeneration constraint flip', () => {
  test('@PrimaryColumn without autogeneration requires non-optional field declaration', () => {
    const tdb = new Database();

    @Entity(tdb, 'ok_required')
    class Ok {
      @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
      id!: PrimaryKey<number>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      name!: string;
    }

    @Entity(tdb, 'bad_required')
    class Bad {
      // @ts-expect-error - field must be non-optional without autogeneration
      @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
      id?: PrimaryKey<number>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      name!: string;
    }

    void Ok;
    void Bad;
  });

  test('@PrimaryColumn with autogeneration requires optional field declaration', () => {
    const tdb = new Database();

    @Entity(tdb, 'ok_optional')
    class Ok {
      @PrimaryColumn({
        type: COLUMN_TYPE.UUID,
        autogeneration: { clientSide: () => 'uuid' },
      })
      id?: PrimaryKey<string>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      name!: string;
    }

    @Entity(tdb, 'bad_optional')
    class Bad {
      // @ts-expect-error - field must be optional with autogeneration
      @PrimaryColumn({
        type: COLUMN_TYPE.UUID,
        autogeneration: { clientSide: () => 'uuid' },
      })
      id!: PrimaryKey<string>;

      @Column({ type: COLUMN_TYPE.TEXT })
      @NotNullable
      name!: string;
    }

    void Ok;
    void Bad;
  });
});

test('@PrimaryColumn rejects unbranded field declaration', () => {
  const tdb = new Database();

  @Entity(tdb, 'ci_unbranded_pk')
  class Bad {
    // @ts-expect-error - id must be PrimaryKey<number>, not plain number
    @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
    id!: number;

    @Column({ type: COLUMN_TYPE.TEXT })
    @NotNullable
    name!: string;
  }

  void Bad;
});
