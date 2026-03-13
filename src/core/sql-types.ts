import type { SQL } from 'bun';

export enum COLUMN_TYPE {
  SMALLINT = 'smallint',
  SERIAL = 'serial',
  SMALLSERIAL = 'smallserial',
  INTEGER = 'integer',
  BIGINT = 'bigint',
  BIGSERIAL = 'bigserial',
  DECIMAL = 'decimal',
  NUMERIC = 'numeric',
  REAL = 'real',
  DOUBLE_PRECISION = 'double precision',
  MONEY = 'money',
  CHAR = 'char',
  VARCHAR = 'varchar',
  TEXT = 'text',
  BYTEA = 'bytea',
  DATE = 'date',
  TIME = 'time',
  TIME_WITH_TIME_ZONE = 'time with time zone',
  BOOLEAN = 'boolean',
  TIMESTAMP = 'timestamp',
  TIMESTAMP_WITH_TIME_ZONE = 'timestamp with time zone',
  INTERVAL = 'interval',
  UUID = 'uuid',
  JSON = 'json',
  JSONB = 'jsonb',
  XML = 'xml',
  POINT = 'point',
  LINE = 'line',
  LSEG = 'lseg',
  BOX = 'box',
  PATH = 'path',
  POLYGON = 'polygon',
  CIRCLE = 'circle',
  CIDR = 'cidr',
  INET = 'inet',
  MACADDR = 'macaddr',
  MACADDR8 = 'macaddr8',
  BIT = 'bit',
  BIT_VARYING = 'bit varying',
  TSVECTOR = 'tsvector',
  TSQUERY = 'tsquery',
  INT4RANGE = 'int4range',
  INT8RANGE = 'int8range',
  NUMRANGE = 'numrange',
  TSRANGE = 'tsrange',
  TSTZRANGE = 'tstzrange',
  DATERANGE = 'daterange',
}

export function getColumnTypeDefinition(sql: SQL, type: COLUMN_TYPE) {
  switch (type) {
    case COLUMN_TYPE.SMALLINT:
      return sql`SMALLINT`;
    case COLUMN_TYPE.SERIAL:
      return sql`SERIAL`;
    case COLUMN_TYPE.SMALLSERIAL:
      return sql`SMALLSERIAL`;
    case COLUMN_TYPE.INTEGER:
      return sql`INTEGER`;
    case COLUMN_TYPE.BIGINT:
      return sql`BIGINT`;
    case COLUMN_TYPE.BIGSERIAL:
      return sql`BIGSERIAL`;
    case COLUMN_TYPE.DECIMAL:
      return sql`DECIMAL`;
    case COLUMN_TYPE.NUMERIC:
      return sql`NUMERIC`;
    case COLUMN_TYPE.REAL:
      return sql`REAL`;
    case COLUMN_TYPE.DOUBLE_PRECISION:
      return sql`DOUBLE PRECISION`;
    case COLUMN_TYPE.MONEY:
      return sql`MONEY`;
    case COLUMN_TYPE.CHAR:
      return sql`CHAR`;
    case COLUMN_TYPE.VARCHAR:
      return sql`VARCHAR`;
    case COLUMN_TYPE.TEXT:
      return sql`TEXT`;
    case COLUMN_TYPE.BYTEA:
      return sql`BYTEA`;
    case COLUMN_TYPE.DATE:
      return sql`DATE`;
    case COLUMN_TYPE.TIME:
      return sql`TIME`;
    case COLUMN_TYPE.TIME_WITH_TIME_ZONE:
      return sql`TIME WITH TIME ZONE`;
    case COLUMN_TYPE.BOOLEAN:
      return sql`BOOLEAN`;
    case COLUMN_TYPE.TIMESTAMP:
      return sql`TIMESTAMP`;
    case COLUMN_TYPE.TIMESTAMP_WITH_TIME_ZONE:
      return sql`TIMESTAMP WITH TIME ZONE`;
    case COLUMN_TYPE.INTERVAL:
      return sql`INTERVAL`;
    case COLUMN_TYPE.UUID:
      return sql`UUID`;
    case COLUMN_TYPE.JSON:
      return sql`JSON`;
    case COLUMN_TYPE.JSONB:
      return sql`JSONB`;
    case COLUMN_TYPE.XML:
      return sql`XML`;
    case COLUMN_TYPE.POINT:
      return sql`POINT`;
    case COLUMN_TYPE.LINE:
      return sql`LINE`;
    case COLUMN_TYPE.LSEG:
      return sql`LSEG`;
    case COLUMN_TYPE.BOX:
      return sql`BOX`;
    case COLUMN_TYPE.PATH:
      return sql`PATH`;
    case COLUMN_TYPE.POLYGON:
      return sql`POLYGON`;
    case COLUMN_TYPE.CIRCLE:
      return sql`CIRCLE`;
    case COLUMN_TYPE.CIDR:
      return sql`CIDR`;
    case COLUMN_TYPE.INET:
      return sql`INET`;
    case COLUMN_TYPE.MACADDR:
      return sql`MACADDR`;
    case COLUMN_TYPE.MACADDR8:
      return sql`MACADDR8`;
    case COLUMN_TYPE.BIT:
      return sql`BIT`;
    case COLUMN_TYPE.BIT_VARYING:
      return sql`BIT VARYING`;
    case COLUMN_TYPE.TSVECTOR:
      return sql`TSVECTOR`;
    case COLUMN_TYPE.TSQUERY:
      return sql`TSQUERY`;
    case COLUMN_TYPE.INT4RANGE:
      return sql`INT4RANGE`;
    case COLUMN_TYPE.INT8RANGE:
      return sql`INT8RANGE`;
    case COLUMN_TYPE.NUMRANGE:
      return sql`NUMRANGE`;
    case COLUMN_TYPE.TSRANGE:
      return sql`TSRANGE`;
    case COLUMN_TYPE.TSTZRANGE:
      return sql`TSTZRANGE`;
    case COLUMN_TYPE.DATERANGE:
      return sql`DATERANGE`;
    default:
      throw new Error(`Unsupported column type: ${type}`);
  }
}
