export const NULLABLE_KEY = Symbol('nullable');

/** Constrains a field's declared type to be optional (i.e., its type must include `undefined`). */
export type NullableField<Value> = Value & (undefined extends Value ? Value : never);

/** Constrains a field's declared type to be required (i.e., its type must NOT include `undefined`). */
export type NotNullableField<Value> = Value & (undefined extends Value ? never : Value);

export function Nullable<This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, NullableField<Value>>,
): void {
  const map: Map<string, boolean> = ((context.metadata[NULLABLE_KEY] as Map<string, boolean>) ??=
    new Map());
  map.set(String(context.name), true);
}

export function NotNullable<This, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, NotNullableField<Value>>,
): void {
  const map: Map<string, boolean> = ((context.metadata[NULLABLE_KEY] as Map<string, boolean>) ??=
    new Map());
  map.set(String(context.name), false);
}
