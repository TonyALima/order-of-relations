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
