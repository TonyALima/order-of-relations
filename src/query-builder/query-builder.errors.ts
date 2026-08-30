import { OrmError } from '../core/orm-error';

export abstract class QueryError extends OrmError {}

export class UndefinedWhereConditionError extends QueryError {
  constructor(readonly conditionIndex: number) {
    super(
      `where() condition at index ${conditionIndex} is undefined. ` +
        'Make sure every field you access in the where callback has a @Column decorator.',
    );
  }
}

export class InvalidOrderByColumnError extends QueryError {
  constructor(readonly column: string) {
    super(`Cannot order by column "${column}": no such column on the entity.`);
  }
}

export class InvalidLimitError extends QueryError {
  constructor(readonly value: number) {
    super(`limit() expects a non-negative number, got ${value}.`);
  }
}

export class InvalidOffsetError extends QueryError {
  constructor(readonly value: number) {
    super(`offset() expects a non-negative number, got ${value}.`);
  }
}
