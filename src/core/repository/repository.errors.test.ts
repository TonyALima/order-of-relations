import { test, expect, describe } from 'bun:test';
import { OrmError } from '../orm-error';
import { RepositoryError, IncompletePrimaryKeyError } from './repository.errors';

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
      'findById() on OrderItem is missing required primary key field(s): orderId, productId',
    );
  });

  test('exposes entityName and missingProperties for programmatic inspection', () => {
    const err = new IncompletePrimaryKeyError('OrderItem', ['productId']);
    expect(err.entityName).toBe('OrderItem');
    expect(err.missingProperties).toEqual(['productId']);
  });
});
