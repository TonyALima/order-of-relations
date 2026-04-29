import { describe, test, expect } from 'bun:test';
import { OrmError } from '../../core/orm-error';
import { MetadataError } from '../../core/metadata/metadata.errors';
import { MissingNullabilityDecoratorError } from './nullable.errors';
import { NULLABLE_KEY, Nullable, NotNullable } from './nullable';

describe('MissingNullabilityDecoratorError', () => {
  test('instanceof chain: OrmError > MetadataError > MissingNullabilityDecoratorError', () => {
    const err = new MissingNullabilityDecoratorError('Column', 'email');
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(MetadataError);
    expect(err).toBeInstanceOf(MissingNullabilityDecoratorError);
  });

  test('has correct name and message for @Column', () => {
    const err = new MissingNullabilityDecoratorError('Column', 'email');
    expect(err.name).toBe('MissingNullabilityDecoratorError');
    expect(err.message).toBe(
      "@Column on 'email' requires @Nullable or @NotNullable to be applied first.",
    );
  });

  test('has correct message for @ToOne', () => {
    const err = new MissingNullabilityDecoratorError('ToOne', 'profile');
    expect(err.message).toBe(
      "@ToOne on 'profile' requires @Nullable or @NotNullable to be applied first.",
    );
  });

  test('exposes decoratorName and propertyName', () => {
    const err = new MissingNullabilityDecoratorError('ToOne', 'nickname');
    expect(err.decoratorName).toBe('ToOne');
    expect(err.propertyName).toBe('nickname');
  });
});

describe('@Nullable', () => {
  test('stores nullable: true in context.metadata under NULLABLE_KEY', () => {
    const metadata: Record<symbol, unknown> = {};

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

describe('@Nullable type-level constraints', () => {
  test('accepts field declared with optional `?` modifier', () => {
    class C {
      @Nullable
      nickname?: string;
    }
    void C;
  });

  test('accepts field with explicit `| undefined` union', () => {
    class C {
      @Nullable
      nickname: string | undefined = undefined;
    }
    void C;
  });

  test('rejects non-optional field declared with definite-assignment `!`', () => {
    class C {
      // @ts-expect-error - @Nullable requires the field type to include `undefined`
      @Nullable
      nickname!: string;
    }
    void C;
  });

  test('rejects union field that does not include `undefined`', () => {
    class C {
      // @ts-expect-error - @Nullable requires the field type to include `undefined`
      @Nullable
      score!: string | number;
    }
    void C;
  });

  test('rejects nullable-via-`null`-only field (null is not undefined)', () => {
    class C {
      // @ts-expect-error - @Nullable requires `undefined` in the type, not `null`
      @Nullable
      avatar: string | null = null;
    }
    void C;
  });
});

describe('@NotNullable type-level constraints', () => {
  test('accepts non-optional field declared with definite-assignment `!`', () => {
    class C {
      @NotNullable
      email!: string;
    }
    void C;
  });

  test('accepts union field that does not include `undefined`', () => {
    class C {
      @NotNullable
      score!: string | number;
    }
    void C;
  });

  test('accepts `null`-only-nullable field (null is not undefined)', () => {
    class C {
      @NotNullable
      avatar: string | null = null;
    }
    void C;
  });

  test('rejects field declared with optional `?` modifier', () => {
    class C {
      // @ts-expect-error - @NotNullable requires the field type to exclude `undefined`
      @NotNullable
      email?: string;
    }
    void C;
  });

  test('rejects field with explicit `| undefined` union', () => {
    class C {
      // @ts-expect-error - @NotNullable requires the field type to exclude `undefined`
      @NotNullable
      email: string | undefined = undefined;
    }
    void C;
  });
});
