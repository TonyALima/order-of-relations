import { OrmError } from '../orm-error';

export abstract class RepositoryError extends OrmError {}

export class IncompletePrimaryKeyError extends RepositoryError {
  constructor(
    readonly entityName: string,
    readonly missingProperties: string[],
  ) {
    super(
      `${entityName} is missing required primary key field(s): ${missingProperties.join(', ')}`,
    );
  }
}

export class EmptyUpdateError extends RepositoryError {
  constructor(readonly entityName: string) {
    super(`${entityName} update requires at least one non-primary-key field to set`);
  }
}
