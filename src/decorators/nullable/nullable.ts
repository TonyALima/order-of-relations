export const NULLABLE_KEY = Symbol('nullable');

export function Nullable<This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, Value & (undefined extends Value ? Value : never)>,
): void {
  const map: Map<string, boolean> = ((context.metadata[NULLABLE_KEY] as Map<string, boolean>) ??=
    new Map());
  map.set(String(context.name), true);
}

export function NotNullable<This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, Value & (undefined extends Value ? never : Value)>,
): void {
  const map: Map<string, boolean> = ((context.metadata[NULLABLE_KEY] as Map<string, boolean>) ??=
    new Map());
  map.set(String(context.name), false);
}
