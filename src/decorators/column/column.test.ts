import { describe, test, expect } from 'bun:test';
import { OrmError } from '../../core/orm-error';
import { MetadataError } from '../../core/metadata/metadata.errors';
import { MissingNullabilityDecoratorError } from './column.errors';

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
