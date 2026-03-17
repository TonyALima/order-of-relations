export type AbstractConstructor<T> = abstract new (...args: unknown[]) => T;

export type ConcreteConstructor<T> = new (...args: unknown[]) => T;

export type Constructor<T = unknown> = AbstractConstructor<T> | ConcreteConstructor<T>;
