export class Container {
  private static instances = new Map<any, any>()

  static register(token: any, instance: any) {
    this.instances.set(token, instance)
  }

  static resolve<T>(target: new (...args: any[]) => T): T {
    if (this.instances.has(target)) {
      return this.instances.get(target)
    }

    const instance = new target()
    this.instances.set(target, instance)
    return instance
  }
}