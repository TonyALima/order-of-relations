import { MetadataError } from '../../core/metadata/metadata.errors';

export class MissingNullabilityDecoratorError extends MetadataError {
  constructor(readonly propertyName: string) {
    super(`@Column on '${propertyName}' requires @Nullable or @NotNullable to be applied first.`);
  }
}
