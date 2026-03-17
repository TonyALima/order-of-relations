export interface Condition {
  columnName: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'IS NULL' | 'IS NOT NULL';
  value?: unknown;
}

export interface FieldConditionBuilder<V> {
  eq(value: V): Condition;
  ne(value: V): Condition;
  gt(value: V): Condition;
  gte(value: V): Condition;
  lt(value: V): Condition;
  lte(value: V): Condition;
  isNull(): Condition;
  isNotNull(): Condition;
}

export type Conditions<T> = {
  [K in keyof T]?: FieldConditionBuilder<T[K]>;
};

export interface FindOptions<T> {
  where?: (conditions: Conditions<T>) => (Condition | undefined)[];
}
