# Arquitetura

## A visão em camadas

O OOR é organizado em **cinco camadas estritas**. Dependências entre camadas apontam sempre para
baixo — uma camada nunca importa de uma camada acima dela. Esta é a regra organizacional
estrutural do codebase, não uma preferência estilística.

```
@Entity / @Column / @PrimaryColumn / @ToOne / @Nullable    ← decorators
                       │  escrevem em
                       ▼
              MetadataStorage (Map<Constructor, EntityMetadata>)
                       │  lido por
                       ▼
                 Repository<T>
                       │  delega leituras compostas a
                       ▼
                 QueryBuilder<T>
                       │  executa via
                       ▼
              Database (conexão SQL do Bun)
```

Cada camada tem uma única responsabilidade estreita:

| Camada | Responsabilidade | Caminho do módulo |
| --- | --- | --- |
| Decorators | Descrever entidades, colunas, relações, nullability | `src/decorators/` |
| MetadataStorage | Guardar descrições de entidade resolvidas, por `Database` | `src/core/metadata/` |
| Repository | CRUD em forma de entidade (`create`, `update`, `delete`, `findById`); delegação de leituras | `src/core/repository/` |
| QueryBuilder | Leituras compostas: callback `where`, conditions proxy, composição de SQL | `src/query-builder/` |
| Database | Conexão `SQL` do Bun, hospedeiro de metadados, `create()`/`drop()` de schema | `src/core/database/` |

Quatro propriedades transversais valem:

1. **Decorators são os únicos escritores de metadados.** Nada fora de `src/decorators/` chama
   `MetadataStorage.set`.
2. **Metadados congelam após a avaliação das classes.** Uma vez carregadas as classes de
   entidade, os metadados ficam imutáveis pelo resto do processo.
3. **O repositório nunca monta SQL por conta própria nos caminhos de leitura.** `findOne`,
   `findMany`, `findById` constroem um `QueryBuilder` e delegam. Escritas são a exceção.
4. **O `SQL` do Bun é a única coisa que toca no wire.** Nada no OOR fala o protocolo PostgreSQL
   diretamente.

### Por que importa

- **O raciocínio é local.** Escolha uma camada; você só precisa das camadas abaixo para
  entendê-la. Uma mudança no `QueryBuilder` não pode ser invalidada por um refactor de
  `Repository`.
- **Isolamento de teste é barato.** Camadas abaixo da testada são fáceis de falsificar (os
  metadados são só um `Map`; `Database` é só um wrapper de conexão).
- **O blast radius de refactors é limitado.** Uma breaking change no `MetadataStorage` se propaga
  para cima por `Repository` e `QueryBuilder`, mas nunca para o lado, em outro módulo de `core/`
  — não existe "para o lado" para onde se propagar.
- **A direção das dependências enforce o design.** "Decorators escrevem metadados, os demais
  leem" é uma propriedade do codebase, não só uma convenção — é mecanicamente verdade porque a
  direção dos imports torna a alternativa impossível de compilar.

### A regra de camadas (forma operacional)

Ao perguntar "onde este código pertence?":

- **Escreve metadados?** Deve viver em `src/decorators/`.
- **Lê metadados para fazer algo?** Pertence a `core/` (qualquer coisa em forma de entidade) ou
  `query-builder/` (qualquer coisa composta).
- **Fala com o wire?** Passa pelo handle `SQL` do Bun em `Database`. Nada mais.

Nada em `core/metadata/` pode importar de cima. Os erros de compilação enforcem a disciplina.

Exemplo real da regra mantendo o codebase honesto: ao adicionar um tipo de coluna novo, a
extensão do enum `COLUMN_TYPE` vive em `src/core/sql-types/`, e o mapeamento para fragmento SQL
também — mas os *decorators* que o expõem (`@Column({ type: COLUMN_TYPE.JSONB })`) vivem em
`src/decorators/` e importam o enum de baixo. O import decorators → sql-types é permitido;
sql-types → decorators, não.

---

## Registro de entidade

A sequência ponta a ponta que transforma uma classe TypeScript decorada numa entrada
`EntityMetadata` no [MetadataStorage](components/metadata-storage.md) de um `Database`. Roda
**uma vez por entidade**, na carga do módulo.

### Passo 1 — Decorators de campo rodam

A spec Stage-3 avalia **decorators de campo antes de decorators de classe** e, dentro de um único
campo, os decorators são aplicados **de baixo para cima** (o mais próximo da propriedade roda
primeiro).

Três chaves-símbolo privadas em `context.metadata`, cada uma com sua forma:

```ts
const COLUMNS_KEY = Symbol('columns'); // ColumnMetadata[]
const RELATIONS_KEY = Symbol('relations'); // RelationMetadata[]
const NULLABLE_KEY = Symbol('nullable'); // Map<string, boolean>
```

- `@Nullable` / `@NotNullable` gravam `NULLABLE_KEY[propertyName] = true | false`. São
  **decorators internos** — precisam rodar antes de `@Column` na mesma propriedade.
- `@Column` lê `NULLABLE_KEY[propertyName]`, lança `MissingNullabilityDecoratorError` se for
  `undefined`, e caso contrário empilha um `ColumnMetadata` (com o `nullable` resolvido embutido)
  em `COLUMNS_KEY`.
- `@PrimaryColumn` pula a verificação de `NULLABLE_KEY` inteiramente (colunas primárias são
  sempre `nullable: false`) e empilha em `COLUMNS_KEY` com `primary: true`.
- `@ToOne` empilha um `RelationMetadata` em `RELATIONS_KEY`. O alvo da relação é fornecido como
  [closure (thunk)](concepts/relations.md) (`() => User`) em vez de referência direta, para que
  grafos circulares de entidades não tropecem na temporal dead zone.

`context.metadata` é novo por classe — declarações de subclasse **não** herdam o bag do pai.

> **Constraint de ordem em toda coluna.** Como `@Column` lê `NULLABLE_KEY` e lança se a entrada
> faltar, `@Nullable` (ou `@NotNullable`) deve ser aplicado **antes** de `@Column`. Na sintaxe
> Stage-3, isso significa que `@Nullable` é o decorator **interno** — mais próximo da
> propriedade:
>
> ```ts
> @Column({ type: COLUMN_TYPE.TEXT })
> @Nullable // <-- interno; roda primeiro
> nickname?: string;
> ```
>
> Inverter os dois lança `MissingNullabilityDecoratorError` em tempo de decoração.
> `@PrimaryColumn` é isento. **Questão em aberto:**
> [questions/decorator-order-independence.md](questions/decorator-order-independence.md) acompanha
> se vale redesenhar para ambas as ordens funcionarem.

### Passo 2 — O decorator de classe roda

`@Entity(db, mapTableName?)` é o decorator de classe. Quando ele executa, todos os decorators de
campo já popularam `context.metadata`. Seu corpo, parafraseado:

```ts
export function Entity(db: Database, mapTableName?: string) {
  return function <T extends Constructor>(value: T, context: ClassDecoratorContext<T>) {
    const tableName = mapTableName ?? String(context.name);
    const columns = (context.metadata[COLUMNS_KEY] as ColumnMetadata[]) ?? [];
    const relations = (context.metadata[RELATIONS_KEY] as RelationMetadata[]) ?? [];

    if (!columns.some((c) => c.primary)) {
      throw new MissingPrimaryColumnError(String(context.name));
    }

    db.getMetadata().set(value, { tableName, columns, relations });
  };
}
```

Três coisas acontecem aqui:

1. Resolve o nome da tabela — default `context.name`.
2. **Valida** — ao menos uma coluna precisa ser primária. Se não: `MissingPrimaryColumnError` é
   lançado *em tempo de decoração*, antes de o storage ser tocado. A classe nunca chega ao
   registro.
3. Comita — `db.getMetadata().set(value, { tableName, columns, relations })`.

`@Entity` **não** lê `NULLABLE_KEY`. Esse bucket já foi consumido por `@Column` no Passo 1 — o
campo `nullable` resolvido está embutido em cada entrada `ColumnMetadata`.

### Passo 3 — O storage vira sua flag de resolução

`MetadataStorage.set()` reseta `isMetadataResolved = false`. Nenhum trabalho de resolução acontece
ainda — a flag apenas sinaliza que a próxima leitura precisa recomputar.

### Passo 4 — A primeira leitura dispara a resolução

O primeiro `db.getMetadata().get(SomeEntity)` (ou qualquer iteração) após um `set()` roda:

- `resolveInheritance` — caminha por
  `Object.getPrototypeOf(target.prototype)?.constructor` para cada classe registrada, adota o
  nome de tabela do ancestral decorado mais alto e atribui / apaga discriminadores. Ver
  [concepts/single-table-inheritance.md](concepts/single-table-inheritance.md).
- `resolveRelations` — para cada relação, chama seu thunk `getTarget()` e procura o resultado no
  storage. Lança `RelationTargetNotFoundError` se o alvo não estiver registrado. Nomes de colunas
  FK que os decorators deixaram `null` são preenchidos aqui.

Depois da resolução, `isMetadataResolved = true`. Leituras subsequentes batem no cache.

### Modos de falha

| Onde | O quê | Resultado |
| --- | --- | --- |
| Passo 1 (`@Column`) | `@Nullable` / `@NotNullable` não aplicado (ou na ordem errada — por fora de `@Column`) | `MissingNullabilityDecoratorError` em tempo de decoração. `@PrimaryColumn` é isento. |
| Passo 2 | Classe sem `@PrimaryColumn` | `MissingPrimaryColumnError` em tempo de decoração; classe nunca registrada |
| Passo 4 | Construtor do alvo da relação nunca registrado com `@Entity` | `RelationTargetNotFoundError` com nome do alvo + caminho da relação (`posts.author`) |
| (Fora deste fluxo) | `storage.get(ClasseNaoRegistrada)` | Retorna `undefined`. A camada de metadados se recusa a lançar porque não consegue desambiguar "esqueceu `@Entity`" de "passou a classe errada" — traduzir isso é trabalho do repositório. |

### Por que essa ordenação é enforceável

A ordem de avaliação do Stage-3 — **decorators de campo antes de decorators de classe** — é o que
torna a validação do Passo 2 possível. Quando `@Entity` roda, o array de colunas já está
completo; "precisa ter uma coluna primária" é decidível agora, não no primeiro uso.

---

## Lifecycle de uma query (findMany)

Walkthrough ponta a ponta de uma leitura composta. A chamada de exemplo:

```ts
userRepo.findMany({
  where: (u) => [u.email!.eq('a@b.com')],
});
```

A mesma forma se aplica a `findOne` (que chama `qb.getOne()` — emite `SELECT ... LIMIT 1`,
retorna `rows[0] ?? null`) e a `findById` (que monta um `where` de chave primária a partir das
colunas primárias da entidade).

### Passo 1 — Entrada no Repository

`Repository.findMany` constrói um `QueryBuilder<User>` novo, ligado ao construtor da entidade e
ao `Database`. **Nenhum SQL é gerado ainda.** O papel do repositório no caminho de leitura é
puramente fábrica + passador de parâmetros; o trabalho real acontece dentro do builder.

### Passo 2 — Resolução de metadados

O query builder chama `db.getMetadata().get(User)`. No primeiro acesso para uma entidade,
`resolveInheritance` e `resolveRelations` rodam (ver
[Registro de entidade](#registro-de-entidade), Passo 4). Acessos subsequentes batem no cache
resolvido.

### Passo 3 — Conditions proxy

O query builder constrói um proxy tipado a partir dos metadados de coluna da entidade: **um
`FieldConditionBuilder` por coluna**. O callback `where` do usuário recebe esse proxy e retorna
um **array** de objetos `Condition`. Cada chamada como `u.email!.eq('a@b.com')` produz uma
`Condition`. Ver [concepts/conditions-proxy.md](concepts/conditions-proxy.md).

### Passo 4 — Validação

O query builder varre o array retornado procurando entradas `undefined`. Se houver alguma, lança
`UndefinedWhereConditionError` carregando o índice ofensor. Isso pega um bug comum:
`u.foo?.eq(...)` avaliado contra uma coluna inexistente produz `undefined` em vez de uma
`Condition`. Sem essa verificação, a query descartaria o predicado em silêncio.

### Passo 4.5 — Discriminador de herança (quando aplicável)

Se `options.inheritance` é `ONLY` ou `SUBCLASSES` (e `meta.discriminator` é truthy — ver
[concepts/single-table-inheritance.md](concepts/single-table-inheritance.md)), `applyOptions`
**empilha** uma condição adicional em `this.conditions` *depois* de o array `where` do usuário ter
sido escrito. Efeito líquido: o predicado de discriminador entra em AND com as condições do
usuário no passo 5. `ALL` é o default e não emite nada; é um branch no-op em `applyOptions`.

### Passo 5 — Composição do SQL

Em `getMany()` (ou implicitamente quando `findMany` o chama):

- Cada `Condition` é mapeada para um fragmento SQL de tagged template na forma
  `` sql`${sql(c.columnName)} ${opFragments[c.op]} ${c.value}` ``.
  - **Nome de coluna** passa pela forma `sql(identificador)` do Bun — binding seguro de
    identificador.
  - **Operador** vem de um mapa estático `opFragments` de fragmentos pré-construídos, chaveado
    por um enum fechado `Condition['op']`. Nunca montado a partir de input de usuário.
  - **Valor** permanece como parâmetro no tagged template.
- O operador `IN` merece destaque: `` sql`${col} IN ${sql(c.value)}` `` — a forma `sql(array)` do
  Bun faz bind de cada elemento como parâmetro. **Array vazio** produz um `IN ()` válido que não
  casa nada, em vez de quebrar. A suíte de testes fixa isso.
- Fragmentos são unidos com `sqlJoin` usando `` sql` AND ` `` como separador. É o único join
  sancionado no codebase — `reduce` feito à mão sobre fragmentos é um footgun conhecido e não é
  usado em lugar nenhum. Ver [concepts/parameterized-sql.md](concepts/parameterized-sql.md).

Não há concatenação de strings de dados fornecidos pelo usuário em nenhum ponto deste caminho
([ADR 0004](decisions/0004-parameterized-sql-only.md)).

### Passo 6 — Execução

O `` sql`SELECT ... FROM ... WHERE ...` `` composto é awaited contra a conexão `SQL` do Bun. As
linhas voltam já em forma de `T[]`.

### Modos de falha

| Onde | O quê | Sintoma |
| --- | --- | --- |
| Passo 2 | Entidade nunca registrada neste `Database` | Lookup retorna `undefined`; código a jusante quebra |
| Passo 3 | Typo no nome da coluna no callback `where` | Acesso ao proxy retorna `undefined`; condição fica `undefined` |
| Passo 4 | Condição `undefined` passou | Lança `UndefinedWhereConditionError` (pego aqui, não em produção) |
| Passo 5 | Operador fora da tabela de fragmentos | Lança em tempo de composição, antes do wire |
| Passo 6 | O `SQL` do Bun retorna erro de driver | A Promise rejeita com o erro do driver |

---

## Lifecycle de um create()

Walkthrough ponta a ponta de um insert. A chamada de exemplo:

```ts
await userRepo.create({ email: 'a@b.com', name: 'Alice' });
// retorna: { id: 42 }   ← PKOutput<User> com apenas a PK
```

### Passo 1 — Checagem de tipos (compilação)

O compilador TypeScript verifica que o argumento casa com `UnbrandedT<T>`. Pelos decorators da
entidade, `T` já codifica a opcionalidade por campo:

- Colunas `@NotNullable` são obrigatórias.
- Colunas `@Nullable` são opcionais.
- Colunas `@PrimaryColumn({ autogeneration })` são opcionais (`NullableField<Value>`).
- Colunas `@PrimaryColumn` sem autogeração são obrigatórias (`NotNullableField<Value>`).

Qualquer coisa faltando ou com tipo errado é erro de compilação. **Custo zero em runtime.**

### Passo 2 — Lookup de metadados

O repositório busca o `EntityMetadata` resolvido da entidade em
`db.getMetadata().get(EntityClass)`. Normalmente já está resolvido a essa altura. Dos metadados,
extrai a lista completa de colunas (para a lista do `INSERT`) e os flags `nullable`, `primary` e
`autogeneration` de cada coluna.

### Passo 3 — Portão `requirePrimaryKey` (runtime)

Para cada coluna `primary: true`:

- Se a coluna tem `autogeneration` declarada → ok, o portão passa.
- Se a coluna não tem `autogeneration` e o objeto da entidade não tem o campo → **lança
  `IncompletePrimaryKeyError`** com `entityName` e `missingProperties`.
- Se a coluna não tem `autogeneration` e o objeto fornece o campo → ok.

É o mesmo portão que `findById`, `update` e `delete` usam — por isso a história de erros é
uniforme nos quatro métodos.

### Passo 4 — Resolução de valores autogerados

Para cada coluna PK com `autogeneration`:

- **`clientSide`:** chama a função (ex.: `crypto.randomUUID()`); guarda o valor para escrever
  tanto nos parâmetros do SQL quanto na PK retornada.
- **`dbSide`:** marca a coluna como "omitida do INSERT" — ela não aparece na lista de colunas,
  mas **aparece** na cláusula `RETURNING`, para que o valor gerado pelo banco volte.

> **O valor do caller vence.** Se o objeto `entity` do caller tem um valor para uma coluna
> autogerada, esse valor explícito vence. O callback de autogeração **não** é invocado, e a
> coluna aparece no `INSERT` como qualquer coluna normal.

### Passo 5 — Composição do `INSERT`

Monta um statement parametrizado `INSERT ... RETURNING` usando `sqlJoin` para a lista de colunas
e a de valores:

```sql
INSERT INTO "users" (email, name)
VALUES ($1, $2)
RETURNING id
```

Propriedades desta composição:

- **Nenhuma interpolação de string de dados do usuário** em lugar algum — valores são parâmetros
  bound; identificadores passam por `sql(c.columnName)`.
- **Colunas com autogeração `dbSide` estão ausentes da lista de colunas**, mas presentes no
  `RETURNING`.
- **`RETURNING` sempre nomeia as colunas de chave primária**, de modo que a linha de resultado
  carrega os valores de PK independentemente da estratégia que os preencheu.

### Passo 6 — Execução

O `` sql`INSERT ... RETURNING ...` `` composto é awaited contra o driver `SQL` do Bun. O
resultado é uma única linha contendo os valores de PK.

### Passo 7 — Retorno

O repositório monta o `PKOutput<T>` retornado:

- Colunas PK `clientSide`: o valor computado no Passo 4.
- Colunas PK `dbSide`: o valor lido da linha do `RETURNING`.
- Overrides de PK fornecidos pelo caller: o valor do caller (já no `INSERT`, também retornado via
  `RETURNING`).

O objeto retornado tem **apenas campos de PK**. As colunas não-PK que o caller passou não são
ecoadas de volta. Isso é deliberado: *"o trabalho de `create()` é persistir uma linha e te dizer
como encontrá-la de novo, não relê-la."* Se você quer a linha completa, a próxima chamada é
`repo.findById(returnedKey)`.

### Modos de falha

| Passo | O quê | Resultado |
| --- | --- | --- |
| 1 | Campo obrigatório faltando ou com tipo errado | Erro de compilação — nunca roda |
| 3 | PK não autogerada ausente (caller sem tipos) | `IncompletePrimaryKeyError` com `missingProperties` |
| 4 | Callback `clientSide` lança | A exceção propaga sem mudança — o repositório não captura |
| 6 | Violação de constraint, erro de FK, queda de conexão | Erro do Bun SQL propaga sem embrulho |
| 6 | Violação de UNIQUE numa PK fornecida pelo caller | Idem — o erro do driver chega ao caller |

---

## Schema create/drop

Como uma instância de `Database` materializa (e desmonta) o schema SQL correspondente às suas
entidades registradas.

> Escopo: cobre apenas `Database.create()` / `Database.drop()`. Migrations além de create/drop
> vivem em [concepts/schema-migrations.md](concepts/schema-migrations.md) — ainda não
> implementadas.

### `Database.create()` — emissão em duas passagens

`create()` percorre os metadados de entidade do `Database` e emite DDL em **duas passagens**:

#### Passagem 1 — tabelas base

Para cada entidade nos metadados, emite um `CREATE TABLE`.

- Colunas vêm de `EntityMetadata.columns` (um fragmento DDL por `ColumnMetadata`, via
  `getColumnTypeDefinition` — ver [components/sql-types.md](components/sql-types.md)).
- Colunas de chave primária são marcadas via `@PrimaryColumn`; a cláusula `PRIMARY KEY` em nível
  de tabela é composta a partir delas.
- Colunas de chave estrangeira vindas de relações são emitidas como colunas simples neste estágio
  — **sem** a constraint de FK.

Duas regras de skip em `createBaseTables`:

```ts
if (metadata.columns.length === 0) continue;
if (metadata.discriminator && metadata.discriminator !== metadata.tableName) continue;
```

- **Skip de colunas vazias:** entidades sem colunas são puladas (defensivo — `@Entity` já rejeita
  classes sem coluna primária).
- **Skip STI só-tabela-base:** entidades de subclasse (cujo `tableName` foi reescrito para o da
  raiz durante `resolveInheritance`, de modo que `discriminator !== tableName`) são puladas.
  **Só a entidade raiz emite `CREATE TABLE`.** É a implementação, no schema-create, de "STI = uma
  tabela para a hierarquia inteira".

#### Emissões STI (quando `metadata.discriminator !== undefined`)

Para uma raiz STI, a passagem de tabelas-base emite três statements em ordem:

1. `CREATE TABLE <tableName> (<columns>, PRIMARY KEY (...))` — igual a qualquer entidade.
2. `ALTER TABLE <tableName> ADD COLUMN discriminator TEXT NOT NULL;`
3. `CREATE INDEX idx_discriminator ON <tableName>(discriminator);`

A coluna discriminadora **e** seu índice só são adicionados quando `meta.discriminator` é truthy
— e `resolveInheritance` apaga o discriminador de entidades sozinhas na tabela. Então uma raiz de
classe única não ganha nem a coluna nem o índice até um irmão se registrar e os metadados
re-resolverem.

> **Colisão latente de nome de índice.** `idx_discriminator` é **compartilhado por toda tabela
> STI** de um schema. Duas hierarquias STI no mesmo schema → o segundo `db.create()` colide no
> nome duplicado do índice. Ver
> [questions/idx-discriminator-collision.md](questions/idx-discriminator-collision.md).

#### Passagem 2 — constraints de chave estrangeira

Para cada relação nos metadados, emite `ALTER TABLE ... ADD FOREIGN KEY (...)`.

A divisão em duas passagens existe porque um `ALTER TABLE ... ADD FOREIGN KEY` exige que a tabela
referenciada já exista. Emitir todas as tabelas-base primeiro remove constraints de ordenação da
passagem 1: as tabelas podem ser criadas em qualquer ordem, sem se preocupar com qual entidade
referencia qual.

### `Database.drop()` — topologicamente revertido

`drop()` não pode ser o reverso literal de `create()` — derrubar uma tabela para a qual a FK de
outra tabela aponta falha com violação de constraint. Em vez disso, `drop()`:

1. Constrói o grafo de relações a partir dos metadados.
2. Computa uma ordenação topológica em que tabelas **referenciadas** precedem **referentes**.
3. Percorre essa ordenação em **reverso** — referentes primeiro, depois seus alvos de FK.

O resultado: todo alvo de chave estrangeira é derrubado *depois* de tudo que o referencia. O
`DROP TABLE` do PostgreSQL tem sucesso a cada passo.

### Modos de falha

| Onde | O quê | Sintoma |
| --- | --- | --- |
| Passagem 1 | Metadados de entidade sem coluna primária | `@Entity` já rejeita isso no registro; se alcançado: `CREATE TABLE` emitiria sem `PRIMARY KEY` |
| Passagem 2 | Relação referencia entidade não registrada | Tabela alvo da FK não existe; `ALTER TABLE` falha no wire |
| `drop()` | Ciclo no grafo de relações | A ordenação topológica não completa; um erro explícito é levantado antes de qualquer DDL rodar |
