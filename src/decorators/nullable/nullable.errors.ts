import { MetadataError } from '../../core/metadata/metadata.errors';

export class MissingNullabilityDecoratorError extends MetadataError {
  constructor(
    readonly decoratorName: string,
    readonly propertyName: string,
  ) {
    super(
      `@${decoratorName} on '${propertyName}' requires @Nullable or @NotNullable to be applied first.`,
    );
  }
}
