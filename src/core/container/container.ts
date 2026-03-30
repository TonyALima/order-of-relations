import type { ConcreteConstructor } from '../utils/utils';

export class Container {
  private static instances = new Map<ConcreteConstructor<unknown>, unknown>();

  static register<T>(token: ConcreteConstructor<T>, instance: T) {
    this.instances.set(token, instance);
  }

  static resolve<T>(target: ConcreteConstructor<T>): T {
    if (this.instances.has(target)) {
      return this.instances.get(target) as T;
    }

    const instance = new target();
    this.instances.set(target, instance);
    return instance;
  }
}
