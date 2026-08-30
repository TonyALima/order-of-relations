# Order of Relations (OOR) — Visão Geral

Um ORM TypeScript opinativo para PostgreSQL. Classes decoradas → metadados → `Repository<T>` →
`QueryBuilder<T>` fluente → SQL parametrizado via driver `sql` do Bun. Projeto duplo: TCC de
graduação (UNIFEI) e pacote npm publicável.

Esta página é o resumo executivo da [documentação canônica](README.md) — as regras estruturais e
os fatos que valem conhecer antes de ler qualquer outra página.

## Regras duras (não violar)

- **Somente decorators ECMAScript Stage-3.** Sem `reflect-metadata`. →
  [ADR 0001](decisions/0001-stage-3-decorators.md)
- **Somente SQL parametrizado.** `sql.unsafe` é banido do codebase inteiro. Sem escotilha
  `qb.raw()`. → [ADR 0004](decisions/0004-parameterized-sql-only.md)
- **`no-any` estrito.** A API pública é orientada a tipos; obrigatório-no-tipo significa
  obrigatório-no-call-site. → [ADR 0005](decisions/0005-no-any-type-driven-api.md)
- **TDD com `bun test`.** Red → green → refactor. Testes de unidade colocados em `src/`;
  integração em `tests/` no topo. → [ADR 0006](decisions/0006-tdd-rhythm.md)
- **Bun é o toolchain único.** Runtime, gerenciador de pacotes, test runner, bundler. Sem
  npm/yarn/pnpm. → [ADR 0007](decisions/0007-bun-toolchain.md)
- **`@Nullable` deve ser o decorator interno** quando empilhado com `@Column`. `@PrimaryColumn` é
  isento. → [concepts/stage-3-decorators.md](concepts/stage-3-decorators.md)
- **`sqlJoin` é o único juntor sancionado de fragmentos.** `reduce` feito à mão sobre fragmentos é
  rejeitado como footgun. → [concepts/parameterized-sql.md](concepts/parameterized-sql.md)

## Arquitetura em cinco camadas

Dependências apontam sempre para baixo. Decorators são os únicos escritores de metadados.

1. **Decorators** — `@Entity`, `@Column`, `@PrimaryColumn`, `@Nullable`, `@NotNullable`, `@ToOne`.
   Escrevem em três chaves-símbolo de `context.metadata`: `COLUMNS_KEY`, `RELATIONS_KEY`,
   `NULLABLE_KEY`.
2. **Metadata** — [MetadataStorage](components/metadata-storage.md) é **por-`Database`** (não
   global à biblioteca). `Map<Constructor, EntityMetadata>`, resolução lazy, idempotente diante
   de adições tardias.
3. **Repository** — superfície estreita por chave, seis métodos públicos no total.
   `create` / `findById` / `update` / `delete` passam por um único portão `requirePrimaryKey`.
   `findOne` / `findMany` são os pontos de entrada de composição (cada um constrói um
   `QueryBuilder` de uso único internamente; **não existe `find()` público**). Tipo de erro
   próprio único: `IncompletePrimaryKeyError`. Erros do driver propagam sem embrulho.
4. **QueryBuilder** — mutável, dono único. Métodos fluentes `where` / `orderBy` / `limit` /
   `offset` (acessíveis por construção direta; `FindOptions` do repositório carrega só `where` e
   `inheritance`). Dois terminais: `getMany()`, `getOne()`. `where()` substitui (não acumula).
5. **Driver** — `SQL` do Bun (somente PostgreSQL).

Detalhe completo em [architecture.md](architecture.md).

## Fatos sobre a forma dos métodos

- `create(entity: UnbrandedT<T>)` — a assinatura é `T` (módulo remoção de brand na entrada), não
  `Partial<T>`. Retorna `PKOutput<T>` com **apenas os campos de PK** (com brand via
  `PrimaryKey<V>`; não é uma entidade hidratada).
- `findById(key: PKInput<T>)` / `delete(key: PKInput<T>)` — forma estrita de PK, toda chave
  obrigatória, tudo sem brand. `findById({})` e `findById({ name: 'x' })` são erros de
  compilação. → [concepts/primary-key-brand.md](concepts/primary-key-brand.md)
- `update(entity: UnbrandedT<T> & PKInput<T>)` — entidade completa, mais chaves PK obrigatórias
  independentemente do modificador opcional em `T`. Fecha o bug silencioso de
  `update({ name: 'x' })` em entidades com autogeração. →
  [ADR 0008](decisions/0008-pk-aware-compile-time.md)
- Autogeração é **somente explícita**: duas estratégias (`clientSide` / `dbSide`); um valor
  fornecido pelo caller sempre vence. → [concepts/autogeneration.md](concepts/autogeneration.md)
- Forma do callback `where`:
  `(conditions: Conditions<T>) => (Condition | undefined)[]`. Entradas de coluna inexistente
  lançam `UndefinedWhereConditionError` carregando o **índice** ofensor.
- `FindOptions<T>` também aceita `inheritance: InheritanceSearchType`
  (`ALL` / `ONLY` / `SUBCLASSES`) — liga/desliga o filtro de discriminador com escopo de
  subclasse nas leituras. → [concepts/single-table-inheritance.md](concepts/single-table-inheritance.md)
- O container de DI está **decidido, mas ainda não implementado**; o código atual usa
  `new Repository(User, db)` direto. → [ADR 0003](decisions/0003-singleton-di-container.md)
- **`COLUMN_TYPE` é um enum fechado de 47 membros.** Decorators só podem declarar tipos desse
  enum — sem escotilha de string. Para suportar um tipo PostgreSQL novo, adiciona-se um membro e
  um branch em `getColumnTypeDefinition`. → [components/sql-types.md](components/sql-types.md)
- **Colunas FK que referenciam uma PK SERIAL são emitidas como `INTEGER`, não `SERIAL`.** Como
  `SERIAL` = `INTEGER` + sequence + `DEFAULT nextval(...)`, uma FK que copiasse o tipo criaria
  uma segunda sequence espúria. `toForeignKeyType()` rebaixa `SERIAL`→`INTEGER`,
  `SMALLSERIAL`→`SMALLINT`, `BIGSERIAL`→`BIGINT` automaticamente; identidade para todo o resto.
  Migrations escritas à mão contra declarações de entidade precisam espelhar isso.

## Onde aprofundar

| Quando você precisa de... | Leia |
| --- | --- |
| Mapa arquitetural completo | [architecture.md](architecture.md) |
| Racional das decisões | [decisions/README.md](decisions/README.md) |
| Contrato do Repository | [components/repository.md](components/repository.md) |
| Mecânica do builder | [components/query-builder.md](components/query-builder.md) · [concepts/lazy-query-builder.md](concepts/lazy-query-builder.md) · [concepts/conditions-proxy.md](concepts/conditions-proxy.md) |
| Registro de entidades e forma dos metadados | [components/metadata-storage.md](components/metadata-storage.md) · [components/database.md](components/database.md) |
| Call sites funcionais | [examples.md](examples.md) |
| Comparação com outros ORMs | [comparisons/README.md](comparisons/README.md) |
| Base de pesquisa (papers) | [research/](research/) |
| Questões em aberto | [questions/README.md](questions/README.md) |
