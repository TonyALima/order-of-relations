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
