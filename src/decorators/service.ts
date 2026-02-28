import { Container } from "../core/container"
import { Repository } from "../core/repository"

const INJECTIONS_KEY = Symbol("injections")

interface InjectionMetadata {
  propertyKey: string
  type: any
  repositoryEntity?: any
}

function getInjections(metadata: DecoratorMetadataObject): InjectionMetadata[] {
  return ((metadata[INJECTIONS_KEY] as InjectionMetadata[]) ??= [])
}

export function Service() {
  return function <T extends new (...args: any[]) => any>(
    value: T,
    context: ClassDecoratorContext<T>
  ) {
    const injections = getInjections(context.metadata)

    return class extends value {
      constructor(...args: any[]) {
        super(...args)

        for (const injection of injections) {
          if (injection.repositoryEntity) {
            ;(this as any)[injection.propertyKey] = new Repository(injection.repositoryEntity)
          } else {
            ;(this as any)[injection.propertyKey] = Container.resolve(injection.type)
          }
        }

        Container.register(this.constructor, this)
      }
    }
  }
}

export function Inject(type: new (...args: any[]) => any) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const injections = getInjections(context.metadata)
    injections.push({ propertyKey: String(context.name), type })
  }
}

export function InjectRepository(entity: any) {
  return function (_value: undefined, context: ClassFieldDecoratorContext) {
    const injections = getInjections(context.metadata)
    injections.push({
      propertyKey: String(context.name),
      type: Repository,
      repositoryEntity: entity,
    })
  }
}
