# Repository

Módulo: `src/core/repository/` · Exporta: `Repository`

## Propósito

`Repository<T>` é a fronteira de persistência da entidade `T`. É dono das operações de linha
única e por chave contra uma entidade. Ele **não** compõe queries (isso é do
[QueryBuilder](query-builder.md)), **não** liga serviços (isso é do futuro
[container de DI](../concepts/di-container.md)) e **não** evolui schema (isso é do
[Database](database.md)).

Regra de bolso: **superfície estreita, contrato profundo.** Todo método que opera sobre chave
primária passa por um único portão privado; toda a história de erros colapsa em um tipo de erro;
o sistema de tipos carrega o resto.

## Operações

`Repository<T>` expõe exatamente **seis** métodos públicos. Quatro deles — `findById`, `delete`,
`update`, `create` — derivam suas formas de entrada/saída de PK do
[brand `PrimaryKey<V>`](../concepts/primary-key-brand.md) nos campos `@PrimaryColumn` da
entidade.

| Método | Assinatura | Responsabilidade |
| --- | --- | --- |
| `create` | `(entity: UnbrandedT<T>) => Promise<PKOutput<T>>` | Insere uma linha, retorna a chave primária (com brand). |
| `findById` | `(key: PKInput<T>) => Promise<T \| null>` | Localiza uma linha pela chave primária completa. |
| `findOne` | `(options?: FindOptions<T>) => Promise<T \| null>` | Monta um `QueryBuilder<T>`, aplica as opções, roda `getOne()`. |
| `findMany` | `(options?: FindOptions<T>) => Promise<T[]>` | Mesma forma de `findOne`, roda `getMany()`. |
| `update` | `(entity: UnbrandedT<T> & PKInput<T>) => Promise<void>` | Sobrescreve a linha identificada pela chave primária. |
| `delete` | `(key: PKInput<T>) => Promise<void>` | Remove a linha pela chave primária. |

`findOne` / `findMany` são os **pontos de entrada de composição** — aceitam `FindOptions<T>` e
executam uma única query SQL. `findById` é o leitor por chave. `create`, `update`, `delete` são
a superfície de escrita.

`PKInput<T>` é a forma estrita de entrada de PK (todas as chaves PK, todas obrigatórias,
não-`undefined`, **sem brand** — o caller passa `{ id: 1 }`, sem cast). `PKOutput<T>` é a mesma
forma **com brand**. `UnbrandedT<T>` é `T` com o brand removido de todos os campos. Ver
[concepts/primary-key-brand.md](../concepts/primary-key-brand.md) para as derivações.

> **Não existe `find()`.** Versões antigas da documentação listavam um `find(): QueryBuilder<T>`
> de "handoff". O builder é construído dentro de `findMany`/`findOne`, usado uma vez e
> descartado. Construção direta (`new QueryBuilder<T>(EntityClass, db)`) é possível, mas é uma
> escotilha interna da biblioteca, não API de usuário documentada.

## O portão `requirePrimaryKey`

Todo método que precisa de chave primária — `create`, `findById`, `update`, `delete` — chama um
único método privado, `requirePrimaryKey`. Ele decide o que conta como "completa" conforme os
metadados de `autogeneration` de cada coluna PK:

- Uma coluna PK **com** `autogeneration` é omissível; o portão não a exige.
- Uma coluna PK **sem** `autogeneration` é obrigatória; o portão lança
  `IncompletePrimaryKeyError` se ausente.

Para chaves primárias compostas, a regra vale **por coluna**.

Esse portão único é o que torna a história de runtime simétrica entre os quatro métodos que usam
PK. Não há uma verificação "está completa?" por método; há uma regra, aplicada quatro vezes.

Depois do trabalho do [brand `PrimaryKey<V>`](../concepts/primary-key-brand.md), o portão é o
**piso** para callers que burlam tipos com cast (`update(data as User)`) — o sistema de tipos pega
os casos principais.

## `create()` — o contrato em detalhe

### Tempo de compilação

A assinatura é `create(entity: UnbrandedT<T>)`, **não** `Partial<T>`. O enforcement de compilação
é delegado ao próprio tipo da entidade — que os decorators moldam via `NullableField<Value>` e
`NotNullableField<Value>`:

| Decorator no campo | Visão de `T` sobre o campo | `create()` exige? |
| --- | --- | --- |
| `@Column @NotNullable` | obrigatório | sim |
| `@Column @Nullable` | opcional | não |
| `@PrimaryColumn({ autogeneration: ... })` | opcional | não |
| `@PrimaryColumn` sem `autogeneration` | obrigatório | sim |

A formulação canônica: *obrigatório no tipo significa obrigatório no `create()`*. A única saída é
`autogeneration`.

O que `create()` **não** verifica em tempo de compilação: relações e forma de FK. Essas passam
por metadados de runtime.

### Runtime

`create()` retorna `Promise<PKOutput<T>>` — o objeto retornado contém exatamente os **campos de
chave primária** (com brand), populados a partir da cláusula `RETURNING` do SQL. Ele **não**
devolve uma entidade hidratada.

O `id` desestruturado é `PrimaryKey<number>`, atribuível a `number` em qualquer lugar onde um
number puro é esperado, então `const { id } = await repo.create(...); await repo.findById({ id })`
funciona sem cerimônia — e o `id!` de código antigo é redundante (`PKOutput<T>` torna os campos
de PK não-`undefined`).

> **Por que `create()` não retorna a linha inteira.** *"O trabalho de `create()` é persistir uma
> linha e te dizer como encontrá-la de novo, não relê-la."* Se você quer a linha completa, chame
> `findById()` em seguida. É mais honesto que ORMs que reidratam automaticamente — o caller
> decide se o round-trip vale a pena.

Para colunas PK autogeradas (ver [concepts/autogeneration.md](../concepts/autogeneration.md)):

- `clientSide`: a biblioteca chama a função uma vez antes do INSERT, escreve o valor no statement
  e na chave retornada.
- `dbSide`: a coluna é omitida do INSERT inteiramente; o banco a preenche; o valor volta via
  `RETURNING`.
- **Um valor explícito do caller sempre vence.** Passar `id: 42` para uma coluna SERIAL ou UUID é
  um override suportado.

Se uma coluna PK não autogerada estiver ausente, `create()` lança `IncompletePrimaryKeyError` —
mesmo caminho dos métodos de leitura.

## Como as leituras compõem

Não há handoff de builder para o caller. `findOne(options?)` e `findMany(options?)` são os pontos
de entrada de composição: constroem um `QueryBuilder<T>`, chamam `applyOptions(options)` e então
o método terminal (`getOne()` / `getMany()`). O builder é curto-vivido e descartado após uma
chamada terminal.

O callback `where` dentro de `FindOptions<T>` é onde a composição mora — ver
[concepts/conditions-proxy.md](../concepts/conditions-proxy.md) para a forma e
[components/query-builder.md](query-builder.md) para a mecânica.

## Modos de falha

| Onde | Erro | Notas |
| --- | --- | --- |
| `findById(key)`, `delete(key)` | `IncompletePrimaryKeyError` | Qualquer propriedade PK ausente em `key`. (O sistema de tipos pega antes via `PKInput<T>`; o portão de runtime pega callers com cast.) |
| `create(entity)` | `IncompletePrimaryKeyError` | Propriedade PK não autogerada ausente. |
| `update(entity)` | `IncompletePrimaryKeyError` | Indiretamente, via `requirePrimaryKey`. |
| Qualquer outra coisa | *(propaga do driver)* | Falhas de conexão, violações de constraint, tipos incompatíveis — vêm do Bun SQL sem embrulho. O repositório é intencionalmente fino em volta deles; embrulhar obscureceria o diagnóstico do driver. |

O erro carrega `entityName` e `missingProperties: string[]`, ambos populados e cobertos por
testes.

## O que está deliberadamente fora de escopo

| Feature | Por que está fora |
| --- | --- |
| **Updates parciais** | `update(entity)` recebe a forma completa. Semântica de merge por campo pertence a um builder, não a um repositório. |
| **Identity map** | Duas chamadas `findById({ id: 1 })` podem retornar dois objetos `User` distintos. Igualdade é **por valor**, não por referência. |
| **Cascade** | Relações são escritas quando presentes no objeto de entrada e ignoradas caso contrário. O repositório nunca alcança outra tabela por conta própria. |
| **Gerenciamento de transações** | Transações são trabalho do caller (ou preocupação futura). O repositório recebe um `Database` e usa a conexão que ele entrega. |

Essas não são lacunas; são a fronteira. *Qualquer coisa composta, reativa ou stateful vai para
outro lugar.*

## Conexões

- [concepts/repository-pattern.md](../concepts/repository-pattern.md) — o conceito que esta
  classe realiza.
- [QueryBuilder](query-builder.md) — construído dentro de `findOne`/`findMany`; usado uma vez e
  descartado.
- [concepts/autogeneration.md](../concepts/autogeneration.md) — a estratégia que esta classe
  executa.
- [ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md) — a decisão de design.
- [ADR 0008](../decisions/0008-pk-aware-compile-time.md) — o brand que amarra as quatro
  assinaturas com PK.
