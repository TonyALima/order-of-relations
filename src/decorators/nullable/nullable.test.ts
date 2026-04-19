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
