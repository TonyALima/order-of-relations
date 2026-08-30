# Autogeneration

## Definição

**Autogeneration** é a estratégia declarada em metadados pela qual uma coluna de chave primária
recebe seu valor quando o caller de `create()` não fornece um. É configurada por `@PrimaryColumn`
via a opção `autogeneration`, com duas estratégias (`clientSide` ou `dbSide`).

```ts
type Autogeneration<Value> =
  | { clientSide: () => Value }
  | { dbSide: (sql: SQL) => SQL.Query<unknown> | undefined };
```

Um `@PrimaryColumn` **sem** `autogeneration` é um campo obrigatório em tempo de compilação e em
runtime — o caller precisa fornecê-lo.

## Como funciona

### `clientSide`

A biblioteca invoca a função fornecida **uma vez antes do INSERT**:

1. Chama `autogeneration.clientSide()` para obter um valor (ex.: `crypto.randomUUID()`).
2. Escreve esse valor na lista de parâmetros do statement SQL.
3. Inclui o mesmo valor no resultado retornado por `create()`.

O banco vê um `INSERT` normal com a PK totalmente fornecida — nada de especial no servidor.

### `dbSide`

A biblioteca **omite a coluna** do `INSERT` inteiramente:

1. Monta o statement SQL com a coluna ausente da lista de colunas.
2. Adiciona a coluna à cláusula `RETURNING`.
3. O banco a preenche (ex.: de uma sequence SERIAL, de um default `gen_random_uuid()`, ou de
   qualquer expressão que o callback `dbSide` forneça).
4. Lê o valor de volta da linha do `RETURNING` e o coloca no resultado.

A assinatura `(sql: SQL) => SQL.Query<unknown> | undefined` do callback `dbSide` permite produzir
uma expressão `DEFAULT` customizada, mas o uso típico simplesmente retorna `undefined` (confiar
no `DEFAULT` existente da coluna).

> **Por que `SERIAL` para PKs `dbSide`.** `SERIAL` é o tipo canônico de `dbSide` porque a DDL
> `SERIAL` do PostgreSQL emite uma coluna `INTEGER` mais uma sequence mais um
> `DEFAULT nextval(...)`. Chaves estrangeiras que referenciam essa PK têm o tipo da coluna
> **automaticamente rebaixado para `INTEGER`** por `toForeignKeyType` — elas não reivindicam uma
> sequence própria. Ver [components/sql-types.md](../components/sql-types.md).

### O valor do caller sempre vence

Se o caller passar um valor para uma coluna autogerada, **o valor explícito vence**. Passar
`id: 42` para uma coluna SERIAL é um override suportado; `id: 'fixed-uuid'` para uma coluna UUID
também. A autogeração só dispara quando o campo está ausente.

## Por que importa

### A regra do somente-explícito

O OOR chegou a inferir autogeração a partir do tipo da coluna — colunas SERIAL autogeravam; todo
o resto, não. Essa inferência foi removida (commit `3aa354b`), por dois motivos:

1. **Tipo e estratégia são dimensões independentes.** Uma coluna UUID `text` pode ser gerada no
   cliente; uma PK `integer` pode ou não ter uma sequence. Confundir tipo com estratégia era um
   vazamento.
2. **A história de compilação do `create()` depende de os metadados dizerem explicitamente
   "omissível".** Um SERIAL sem `autogeneration` agora é um campo obrigatório perfeitamente
   normal no nível de tipos, e o portão de runtime concorda — `create({ name: 'x' })` numa
   entidade assim é *tanto* erro de compilação *quanto* `IncompletePrimaryKeyError` em runtime se
   a checagem de tipos for burlada.

É isso que torna o contrato de tipos honesto: não existe um modo implícito de "o banco resolve".

### A forma de PK autogerada que deixava `update` silenciosamente quebrado (fechado em 2026-04-30)

PKs autogeradas são declaradas com o modificador `?` — `id?: PrimaryKey<number>` — porque
`create()` permite ao caller omiti-las. Esse modificador opcional em `T` é o que fazia
`update(entity: T)` aceitar `update({ name: 'x' })` e montar silenciosamente `WHERE id = NULL`.
O trabalho do [brand `PrimaryKey<V>`](primary-key-brand.md) fecha isso no nível de tipos: o input
de `update` agora é `UnbrandedT<T> & PKInput<T>`, onde `PKInput<T>` exige toda chave PK
não-`undefined` independentemente do modificador opcional em `T`. Ver
[ADR 0008](../decisions/0008-pk-aware-compile-time.md) para o raciocínio completo.

### Chaves primárias compostas

Para PKs compostas, a autogeração é decidida **por coluna**. Uma coluna pode ter
`autogeneration: { dbSide: ... }`; outra pode ser obrigatória. O portão `requirePrimaryKey`
avalia cada uma independentemente.

## Exemplos

```ts
class User {
  // dbSide: SERIAL/sequence; coluna omitida do INSERT, retornada via RETURNING.
  // O modificador opcional (`?`) é exigido porque `create()` permite ao caller
  // omitir o campo; o brand PrimaryKey<number> é exigido pelo overload de @PrimaryColumn.
  @PrimaryColumn({
    type: COLUMN_TYPE.INTEGER,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  email!: string;
}

class Session {
  // clientSide: a biblioteca chama crypto.randomUUID() antes do INSERT.
  @PrimaryColumn({
    type: COLUMN_TYPE.TEXT,
    autogeneration: { clientSide: () => crypto.randomUUID() },
  })
  id?: PrimaryKey<string>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  userId!: string;
}

class Account {
  // Sem autogeneration: o caller DEVE fornecer externalId.
  // O modificador obrigatório (`!`) e o brand são ambos exigidos pelo overload.
  @PrimaryColumn({ type: COLUMN_TYPE.TEXT })
  externalId!: PrimaryKey<string>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;
}

const userRepo = new Repository(User, db);
const sessionRepo = new Repository(Session, db);
const accountRepo = new Repository(Account, db);

await userRepo.create({ email: 'a@b.com' }); // ok — id vem do banco
await sessionRepo.create({ userId: 'u1' }); // ok — id vem do clientSide
await accountRepo.create({ name: 'x' }); // erro de compilação E
// IncompletePrimaryKeyError — externalId é obrigatório.

// O valor do caller vence
await userRepo.create({ id: 42, email: 'a@b.com' }); // INSERT escreve id=42
// explicitamente; dbSide é pulado.
```

## Armadilhas

- **Esquecer `autogeneration` num SERIAL.** Se você migra de outro ORM em que SERIAL implicava
  autogeração, seu `@PrimaryColumn({ type: COLUMN_TYPE.INTEGER })` será obrigatório em tempo de
  `create()`. O erro é alto (compilação + runtime), mas a causa pode não ser óbvia.
- **`dbSide: () => undefined` como no-op.** Muitos casos de autogeração querem apenas "deixe o
  `DEFAULT` da DDL da coluna cuidar". A assinatura exige uma função; passar `() => undefined` é o
  idioma para "eu só quero a coluna omitida do `INSERT`".

## Conexões

- [components/repository.md](../components/repository.md) — a classe que executa contra esses
  metadados.
- [primary-key-brand.md](primary-key-brand.md) — o brand que os overloads de `@PrimaryColumn`
  exigem, qualquer que seja a estratégia de autogeração.
- [architecture.md — lifecycle de um create](../architecture.md#lifecycle-de-um-create) — o fluxo
  mostrando exatamente quando `clientSide` dispara (antes do INSERT) vs. quando `dbSide` lê de
  volta (do RETURNING).
- [ADR 0008](../decisions/0008-pk-aware-compile-time.md) — a decisão que fecha o bug silencioso
  de `update` que a autogeração tornava estruturalmente possível.
