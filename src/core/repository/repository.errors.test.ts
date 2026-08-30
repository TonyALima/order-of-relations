import { test, expect, describe } from 'bun:test';
import { OrmError } from '../orm-error';
import { RepositoryError, IncompletePrimaryKeyError, EmptyUpdateError } from './repository.errors';

describe('IncompletePrimaryKeyError', () => {
  test('instanceof chain: OrmError > RepositoryError > IncompletePrimaryKeyError', () => {
    const err = new IncompletePrimaryKeyError('OrderItem', ['productId']);
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(RepositoryError);
    expect(err).toBeInstanceOf(IncompletePrimaryKeyError);
  });

  test('has correct name and message listing the missing properties', () => {
    const err = new IncompletePrimaryKeyError('OrderItem', ['orderId', 'productId']);
    expect(err.name).toBe('IncompletePrimaryKeyError');
    expect(err.message).toBe(
      'OrderItem is missing required primary key field(s): orderId, productId',
    );
  });

  test('exposes entityName and missingProperties for programmatic inspection', () => {
    const err = new IncompletePrimaryKeyError('OrderItem', ['productId']);
    expect(err.entityName).toBe('OrderItem');
    expect(err.missingProperties).toEqual(['productId']);
  });
});

describe('EmptyUpdateError', () => {
  test('instanceof chain: OrmError > RepositoryError > EmptyUpdateError', () => {
    const err = new EmptyUpdateError('User');
    expect(err).toBeInstanceOf(OrmError);
    expect(err).toBeInstanceOf(RepositoryError);
    expect(err).toBeInstanceOf(EmptyUpdateError);
  });

  test('has correct name and message', () => {
    const err = new EmptyUpdateError('User');
    expect(err.name).toBe('EmptyUpdateError');
    expect(err.message).toBe('User update requires at least one non-primary-key field to set');
  });

  test('exposes entityName for programmatic inspection', () => {
    const err = new EmptyUpdateError('User');
    expect(err.entityName).toBe('User');
  });
});
