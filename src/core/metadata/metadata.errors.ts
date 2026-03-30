import { OrmError } from '../orm-error';

export abstract class MetadataError extends OrmError {}

export class RelationTargetNotFoundError extends MetadataError {
  constructor(
    readonly targetName: string,
    readonly relationPath: string,
  ) {
    super(
      `Relation target "${targetName}" not found for relation "${relationPath}, ensure the target entity is defined and decorated with @Entity"`,
    );
  }
}
