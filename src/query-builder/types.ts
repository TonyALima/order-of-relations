export interface Condition {
  columnName: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'IS NULL' | 'IS NOT NULL' | 'IN';
  value?: unknown | unknown[];
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
  in(values: V[]): Condition;
}

export type Conditions<T> = {
  [K in keyof T]?: FieldConditionBuilder<T[K]>;
};

export enum INHERITANCE_SEARCH_TYPE {
  ALL = 'ALL',
  ONLY = 'ONLY',
}

export interface FindOptions<T> {
  where?: (conditions: Conditions<T>) => (Condition | undefined)[];
  inheritance?: INHERITANCE_SEARCH_TYPE;
}
