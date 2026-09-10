# Contratos do `Repository`

`Repository<T>` persiste e recupera uma entidade já registrada em um
`Database`. Este guia cobre as quatro operações orientadas pela chave primária:
`create`, `findById`, `update` e `delete`.

## Assinaturas e chaves primárias

As assinaturas implementadas são:

| Método | Assinatura | Resultado |
| --- | --- | --- |
| `create` | `(entity: UnbrandedT<T>) => Promise<PKOutput<T>>` | Insere a entidade e devolve todos os campos da chave primária. |
| `findById` | `(key: PKInput<T>) => Promise<T \| null>` | Busca pela chave primária completa. |
| `update` | `(entity: Partial<UnbrandedT<T>> & PKInput<T>) => Promise<void>` | Atualiza os campos enviados na linha identificada pela chave primária completa. |
| `delete` | `(key: PKInput<T>) => Promise<void>` | Remove a linha identificada pela chave primária completa. |

`UnbrandedT`, `PKInput` e `PKOutput` são detalhes de implementação usados nas
assinaturas. Não precisam ser importados: o TypeScript os infere a partir dos
campos `PrimaryKey` declarados na entidade. Em entradas, o valor da chave não
tem brand (`{ id: 1 }`); a saída de `create` tem brand e pode ser passada
diretamente para `findById`, `update` ou `delete`.

Os campos obrigatórios na entidade também são obrigatórios em `create`. Um
campo declarado como opcional continua opcional na entrada. Uma PK sem
autogeração deve ser declarada como obrigatória; uma PK com autogeração deve
ser opcional.

```ts
import {
  COLUMN_TYPE,
  Column,
  Database,
  Entity,
  NotNullable,
  Nullable,
  PrimaryColumn,
  type PrimaryKey,
  Repository,
} from 'order-of-relations';

const db = new Database();

@Entity(db, 'sessions')
class Session {
  @PrimaryColumn({
    type: COLUMN_TYPE.SERIAL,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;

  @Column({ type: COLUMN_TYPE.TEXT })
  @Nullable
  note?: string;
}

db.connect(process.env.DATABASE_URL);
await db.create();

const sessions = new Repository(Session, db);
const created = await sessions.create({ name: 'Planning' });
// created é { id: PrimaryKey<number> } e `note` pode ser omitido.

const session = await sessions.findById(created);
if (session) {
  await sessions.update({ id: session.id, note: 'Confirmed' });
}

await sessions.delete(created);
```

`findById` retorna `null` quando não encontra uma linha. `update` e `delete`
resolvem com `void`, inclusive quando nenhuma linha corresponde à chave. O
`update` é uma operação parcial: requer a PK completa e escreve somente os
campos não-PK fornecidos. Colunas e relações omitidas preservam os valores já
armazenados.

## Autogeração

`autogeneration` é explícita em `@PrimaryColumn`: o tipo SQL da coluna não
implica uma estratégia de geração. Quando o chamador fornece a PK, esse valor
sempre prevalece sobre as estratégias abaixo.

### `clientSide`

Com `clientSide`, `create` chama a função uma vez antes do `INSERT`, inclui o
valor na consulta e o devolve na chave criada. Use quando a aplicação deve
conhecer a chave antes de enviar a inserção ao PostgreSQL.

```ts
import {
  COLUMN_TYPE,
  Column,
  Database,
  Entity,
  NotNullable,
  PrimaryColumn,
  type PrimaryKey,
  Repository,
} from 'order-of-relations';

const db = new Database();

@Entity(db, 'client_sessions')
class ClientSession {
  @PrimaryColumn({
    type: COLUMN_TYPE.UUID,
    autogeneration: { clientSide: () => crypto.randomUUID() },
  })
  id?: PrimaryKey<string>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;
}

const sessions = new Repository(ClientSession, db);
const created = await sessions.create({ name: 'Offline-ready' });
// created.id é o UUID produzido por crypto.randomUUID().
```

### `dbSide`

Com `dbSide`, `Database.create()` chama o callback ao criar o esquema. Um
fragmento SQL retornado vira o `DEFAULT` da coluna; `undefined` deixa a
definição do tipo cuidar disso, como no `SERIAL`. Em `Repository.create`, uma
PK `dbSide` omitida não entra no `INSERT`; o valor produzido pelo PostgreSQL
volta por `RETURNING`.

```ts
@Entity(db, 'database_sessions')
class DatabaseSession {
  @PrimaryColumn({
    type: COLUMN_TYPE.UUID,
    autogeneration: { dbSide: (sql) => sql`gen_random_uuid()` },
  })
  id?: PrimaryKey<string>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;
}
```

O segundo exemplo usa as mesmas APIs públicas importadas no exemplo anterior.

## Chaves compostas

Cada operação por chave exige todos os campos de uma chave composta. A regra
vale separadamente para cada coluna: uma parte pode ser autogerada enquanto as
outras continuam obrigatórias.

```ts
@Entity(db, 'order_items')
class OrderItem {
  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  orderId!: PrimaryKey<number>;

  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  productId!: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.INTEGER })
  @NotNullable
  quantity!: number;
}

const items = new Repository(OrderItem, db);

const key = await items.create({ orderId: 10, productId: 20, quantity: 1 });
await items.findById({ orderId: 10, productId: 20 });
await items.update({ orderId: 10, productId: 20, quantity: 2 });
await items.delete(key);
```

## Erros que o consumidor pode tratar

Em chamadas tipadas, o compilador impede chaves ausentes. A validação continua
em runtime para chamadas JavaScript ou para código que burlou os tipos:

- `IncompletePrimaryKeyError` é lançado por `findById`, `delete` e `update`
  quando falta qualquer parte da PK. Em `create`, ele é lançado quando falta
  uma parte da PK que não tem `autogeneration`.
- `EmptyUpdateError` é lançado por `update` quando a entrada contém somente a
  PK, sem nenhum campo não-PK para atualizar.
- `DatabaseNotConnectedError` pode ser lançado quando o `Database` ainda não
  recebeu `connect()`.

Erros de conexão, constraints e demais falhas do PostgreSQL não são
convertidos pelo `Repository`; o erro do driver é propagado. Não existe erro de
"não encontrado": a leitura retorna `null`, e escrita ou remoção sem linha
correspondente terminam normalmente.
