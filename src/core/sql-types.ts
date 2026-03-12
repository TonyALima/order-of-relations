import type { SQL } from 'bun';

export enum COLUMN_TYPE {
  SERIAL = 'serial',
  INTEGER = 'integer',
  TEXT = 'text',
  BOOLEAN = 'boolean',
  TIMESTAMP = 'timestamp',
}

export function getColumnTypeDefinition(sql: SQL, type: COLUMN_TYPE) {
  switch (type) {
    case COLUMN_TYPE.SERIAL:
      return sql`SERIAL`;
    case COLUMN_TYPE.INTEGER:
      return sql`INTEGER`;
    case COLUMN_TYPE.TEXT:
      return sql`TEXT`;
    case COLUMN_TYPE.BOOLEAN:
      return sql`BOOLEAN`;
    case COLUMN_TYPE.TIMESTAMP:
      return sql`TIMESTAMP`;
    default:
      throw new Error(`Unsupported column type: ${type}`);
  }
}
