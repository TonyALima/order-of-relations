import { MetadataError } from '../../core/metadata/metadata.errors';

export class MissingPrimaryColumnError extends MetadataError {
  constructor(readonly entityName: string) {
    super(`Entity "${entityName}" must have at least one primary column`);
  }
}
