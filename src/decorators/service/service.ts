import { Container } from '../../core/container/container';
import { Repository } from '../../core/repository/repository';
import type { ConcreteConstructor } from '../../core/utils/utils';

const INJECTIONS_KEY = Symbol('injections');

interface InjectionMetadata {
  propertyKey: string;
  type?: new (...args: unknown[]) => object;
  repositoryEntity?: new () => unknown;
}

function getInjections(metadata: DecoratorMetadataObject): InjectionMetadata[] {
  return ((metadata[INJECTIONS_KEY] as InjectionMetadata[]) ??= []);
}

export function Service() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(
    value: T,
    context: ClassDecoratorContext<T>,
  ) {
    const injections = getInjections(context.metadata);

    return class extends value {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        super(...args);

        for (const injection of injections) {
          if (injection.repositoryEntity) {
            (this as Record<string, unknown>)[injection.propertyKey] = new Repository(
              injection.repositoryEntity,
            );
          } else if (injection.type) {
            (this as Record<string, unknown>)[injection.propertyKey] = Container.resolve(
              injection.type,
            );
          }
        }

        Container.register(this.constructor as ConcreteConstructor<this>, this);
      }
    };
  };
}

export function Inject(type: new (...args: unknown[]) => object) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const injections = getInjections(context.metadata);
    injections.push({ propertyKey: String(context.name), type });
  };
}

export function InjectRepository(entity: new () => unknown) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const injections = getInjections(context.metadata);
    injections.push({
      propertyKey: String(context.name),
      repositoryEntity: entity,
    });
  };
}
