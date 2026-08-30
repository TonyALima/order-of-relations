# sql-types

Módulo: `src/core/sql-types/` · Exporta `COLUMN_TYPE` pelo barrel público

## Propósito

`src/core/sql-types/` é a **superfície de tipos para identificadores de DDL** — o inventário
fechado de tipos PostgreSQL que os decorators têm permissão de declarar, mais os helpers que
transformam cada tipo em um fragmento SQL ou em sua contraparte de chave estrangeira.

É o paralelo de [parameterized SQL](../concepts/parameterized-sql.md) para DDL: assim como
valores passam pelo driver como parâmetros bound (nunca concatenados como string), todo token de
tipo de DDL é bound a um enum (nunca fornecido como string).

## Exports

### `enum COLUMN_TYPE`

Enum fechado com 47 tipos PostgreSQL — todo o universo que um `@Column` / `@PrimaryColumn` pode
declarar.

| Grupo | Membros |
| --- | --- |
| Numéricos | `SMALLINT`, `INTEGER`, `BIGINT`, `SMALLSERIAL`, `SERIAL`, `BIGSERIAL`, `DECIMAL`, `NUMERIC`, `REAL`, `DOUBLE_PRECISION`, `MONEY` |
| Caractere / binário | `CHAR`, `VARCHAR`, `TEXT`, `BYTEA` |
| Data / hora | `DATE`, `TIME`, `TIME_WITH_TIME_ZONE`, `TIMESTAMP`, `TIMESTAMP_WITH_TIME_ZONE`, `INTERVAL` |
| Booleano & UUID | `BOOLEAN`, `UUID` |
| Estruturados | `JSON`, `JSONB`, `XML` |
| Geométricos | `POINT`, `LINE`, `LSEG`, `BOX`, `PATH`, `POLYGON`, `CIRCLE` |
| Rede | `CIDR`, `INET`, `MACADDR`, `MACADDR8` |
| Bit-string | `BIT`, `BIT_VARYING` |
| Text-search | `TSVECTOR`, `TSQUERY` |
| Range | `INT4RANGE`, `INT8RANGE`, `NUMRANGE`, `TSRANGE`, `TSTZRANGE`, `DATERANGE` |

**Sem escotilha de string.** Passar uma string que não é membro de `COLUMN_TYPE` é erro de
compilação. É isso que sustenta a [ADR 0004](../decisions/0004-parameterized-sql-only.md) para
identificadores de DDL — o sistema de tipos elimina fragmentos de DDL fornecidos pelo usuário na
origem.

### `getColumnTypeDefinition(sql, type)`

Um `switch` de cada `COLUMN_TYPE` para um fragmento SQL parametrizado usando a forma de tagged
template do Bun (ex.: `COLUMN_TYPE.TIMESTAMP_WITH_TIME_ZONE` →
`` sql`TIMESTAMP WITH TIME ZONE` ``). O branch default lança `UnsupportedColumnTypeError`.

É o **único** produtor de fragmentos de DDL do codebase. Tudo que `Database.createBaseTables`
emite em nível de coluna passa por ele.

### `toForeignKeyType(type)`

O não óbvio. Quando a coluna de chave estrangeira de uma relação herda seu tipo da coluna de
chave primária do alvo, tipos SERIAL são **rebaixados** para o tipo inteiro subjacente:

```ts
case COLUMN_TYPE.SERIAL:      return COLUMN_TYPE.INTEGER;
case COLUMN_TYPE.SMALLSERIAL: return COLUMN_TYPE.SMALLINT;
case COLUMN_TYPE.BIGSERIAL:   return COLUMN_TYPE.BIGINT;
default:                      return type; // identidade para todo o resto
```

> **Por que colunas FK não podem ser SERIAL.** `SERIAL` é açúcar sintático do PostgreSQL para
> `INTEGER` mais uma sequence e um `DEFAULT nextval(...)`. Uma coluna FK que *referencia* uma PK
> SERIAL não é dona da sequence — ela só armazena o inteiro. Emitir `SERIAL` na FK (a) criaria
> uma segunda sequence espúria e (b) penduraria um `DEFAULT` numa coluna que deve sempre copiar o
> id da linha pai. Rebaixar para o inteiro subjacente é a DDL correta.

O usuário nunca vê essa transformação — declara `@ToOne(() => User)` e o tipo da coluna FK é
derivado. Mas quem raciocina sobre a DDL emitida precisa saber: *se `User.id` é SERIAL, a coluna
FK `author_id` de `Post` será emitida como INTEGER.*

## Call sites

- `MetadataStorage.resolveRelations()` chama `toForeignKeyType(pk.type)` quando a relação não tem
  colunas FK explícitas:

  ```ts
  relation.columns = primaryColumns.map((pk) => ({
    name: `${relation.propertyName}_${pk.propertyName}`,
    type: toForeignKeyType(pk.type),
    referencedProperty: pk.propertyName,
  }));
  ```

- `Database.createBaseTables()` chama `getColumnTypeDefinition(sql, type)` por coluna ao emitir
  `CREATE TABLE`.

## Erros

- `UnsupportedColumnTypeError` — lançado pelo branch default de `getColumnTypeDefinition`.
  Definido em `src/core/sql-types/sql-types.errors.ts`.

## Conexões

- [concepts/autogeneration.md](../concepts/autogeneration.md) — por que
  `SERIAL + dbSide` é a escolha canônica de PK; esta página explica o lado FK da mesma decisão.
- [concepts/relations.md](../concepts/relations.md) — `resolveRelations` (que chama o thunk) é
  também onde `toForeignKeyType` roda.
- [MetadataStorage](metadata-storage.md) — dono da passagem de resolução que chama esses helpers.
