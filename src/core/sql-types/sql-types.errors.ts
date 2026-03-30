import { OrmError } from '../orm-error';

export abstract class SchemaError extends OrmError {}

export class UnsupportedColumnTypeError extends SchemaError {
  constructor(readonly columnType: string) {
    super(`Unsupported column type: ${columnType}`);
  }
}
