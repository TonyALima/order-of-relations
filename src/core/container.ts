export type Constructor<T = unknown> = new (...args: unknown[]) => T

export class Container {
  private static instances = new Map<Constructor, unknown>()

  static register<T>(token: Constructor<T>, instance: T) {
    this.instances.set(token, instance)
  }

  static resolve<T>(target: Constructor<T>): T {
    if (this.instances.has(target)) {
      return this.instances.get(target) as T
    }

    const instance = new target()
    this.instances.set(target, instance)
    return instance
  }
}