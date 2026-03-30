import { OrmError } from '../orm-error';

export abstract class DatabaseError extends OrmError {}

export class DatabaseNotConnectedError extends DatabaseError {
  constructor() {
    super('Database not connected. Call Database.connect() first.');
  }
}
