# OOR vs TypeORM

> **Veredito.** O OOR mantém tudo que fez do TypeORM o ORM baseado em decorators default e
> endurece o contrato nos quatro eixos em que o TypeORM vem mostrando idade: dialeto de
> decorators, segurança de SQL, estricção de tipos e a fronteira simples-vs-composto. A
> contribuição é ergonomia em formato TypeORM com garantias modernas.

## O que o OOR traz de novo

- **Um dialeto moderno de decorators na fundação.** Decorators Stage-3 sem polyfill
  `reflect-metadata`, sem flag `experimentalDecorators` — o dialeto que o TypeScript trata como
  default, na via de padronização. ([ADR 0001](../decisions/0001-stage-3-decorators.md))
- **SQL injection como propriedade de corretude, não disciplina.** Sem `sql.unsafe`, sem
  fragmentos de SQL cru em lugar nenhum — inclusive dentro da própria biblioteca. A classe
  inteira de bugs de injeção que vão para produção através das strings de `WHERE` do TypeORM é
  removida por construção. ([ADR 0004](../decisions/0004-parameterized-sql-only.md))
- **Uma API de predicados tipada em vez de strings SQL.** `where(cb => cb.email!.eq(value))`
  substitui o `.where("user.email = :email", { email })` do TypeORM. Tipos de coluna constrangem
  o lado direito em tempo de compilação; o usuário nunca escreve um fragmento SQL.
  ([concepts/conditions-proxy.md](../concepts/conditions-proxy.md))
- **No-`any` estrito da superfície pública para dentro.** Rejeição em tempo de compilação de
  entidades parciais e referências de coluna ruins, não violações de `NOT NULL` em runtime.
  ([ADR 0005](../decisions/0005-no-any-type-driven-api.md))
- **Uma fronteira unidirecional simples-vs-composto.** Operações simples no `Repository<T>`;
  composição via callback `where` / `FindOptions`. Sem caminhos paralelos, sem decisão
  "chamo `find()` ou `createQueryBuilder()`?" por query.
  ([ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md))

## Visão geral

O TypeORM é o incumbente óbvio contra o qual o OOR é mais frequentemente *desenhado*: ambos são
dirigidos por decorators, ambos expõem `Repository<T>`, ambos entregam um query builder lazy,
ambos miram bancos relacionais. A genealogia é real. O argumento do OOR não é que o TypeORM está
errado — é que as escolhas de design do TypeORM foram feitas quando o contexto de linguagem e
runtime era diferente, e várias dessas escolhas parecem estruturais em retrospecto sem que
precisem ser.

> **O OOR é o TypeORM, modernizado.** Leia esta comparação como uma tese: o ORM que a maioria dos
> desenvolvedores TypeScript busca primeiro carrega anos de escolhas feitas sob constraints
> (`reflect-metadata`, decorators legados, fragmentos de SQL cru) que não se aplicam mais. O OOR
> é uma implementação clean-room da mesma forma com essas constraints removidas.

## Comparação

> **Regra de valor equivalente para features planejadas.** Features planejadas com página de
> questão em aberto totalmente circunscrita (eixos explicitados, superfície de decorator definida,
> superfície de mudança descrita) aparecem abaixo como parte da contribuição do OOR. A
> contribuição do TCC é o design; a implementação é trabalho incremental a jusante dele.

| Dimensão | OOR | TypeORM (v0.3.x) |
| --- | --- | --- |
| **Dialeto de decorators** | Somente decorators ECMAScript **Stage-3**. Sem `reflect-metadata`, sem `experimentalDecorators`. Default no `tsc --init` desde o TS 5.0. ([ADR 0001](../decisions/0001-stage-3-decorators.md)) | Decorators legados do TypeScript. Exige `experimentalDecorators: true`, `emitDecoratorMetadata: true` e `import "reflect-metadata"` no entry point da aplicação. |
| **Armazenamento de metadados** | Pertencente à biblioteca: `MetadataStorage: Map<Constructor, EntityMetadata>` por instância de `Database`. Três símbolos (`COLUMNS_KEY`, `NULLABLE_KEY`, `RELATIONS_KEY`) unidos por `@Entity`. A forma do storage pode evoluir sem colidir com qualquer outra coisa na aplicação hospedeira. ([components/metadata-storage.md](../components/metadata-storage.md)) | `MetadataArgsStorage` global populado via `Reflect.metadata`. Compartilha o registro global com o que mais a aplicação hospedeira usar de `Reflect.metadata`. |
| **API de ponto de entrada** | `Repository<T>` é o **único** ponto de entrada por entidade. Seis métodos executam SQL diretamente; a composição mora no callback `where` / `FindOptions<T>` (`findMany` / `findOne` constroem o builder internamente). Um modelo mental: simples → métodos do `Repository`; composto → opções tipadas. ([ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md)) | Três superfícies coexistindo: `DataSource`, `EntityManager`, `Repository<T>`. `Repository.find()` executa imediatamente; composição exige `Repository.createQueryBuilder()` — um caminho separado. |
| **Forma do query builder** | Mutável, dono único. [Conditions Proxy](../concepts/conditions-proxy.md) tipado em `where(cb => cb.field!.eq(value))` — sem strings SQL, sem helpers de operador. Terminais: `getMany()` / `getOne()`; cláusulas fluentes `orderBy` / `limit` / `offset`. ([concepts/lazy-query-builder.md](../concepts/lazy-query-builder.md)) | `SelectQueryBuilder` mutável. Where-clauses são fragmentos SQL crus com parâmetros nomeados: `.where("user.firstName = :firstName", { firstName })`. Predicados aninhados via classe de callback `Brackets`. |
| **Segurança de SQL** | `sql.unsafe` banido no codebase inteiro. Sem interpolação crua em lugar nenhum — nem no código do usuário, nem nos internals da biblioteca. ([ADR 0004](../decisions/0004-parameterized-sql-only.md)) | Where-clauses são fragmentos SQL rotineiramente; `repository.query(sql, params)` é uma API crua de primeira classe. A segurança contra injeção depende de o usuário escolher a forma de parâmetro nomeado. |
| **Estricção de tipos** | No-`any` estrito enforced via `@typescript-eslint/no-explicit-any`. `create(entity: T)` rejeita entidades parciais em tempo de compilação. ([ADR 0005](../decisions/0005-no-any-type-driven-api.md)) | Métodos públicos são genéricos, mas o binding de parâmetros passa por `ObjectLiteral = { [key: string]: any }`. Sem postura no-`any` em nível de projeto. |
| **Índices** | ⏳ `@Index` e `@Unique` em nível de propriedade + classe, com nomes auto-gerados e política de nomes uniforme que também cobre o índice de discriminador STI. Circunscrito em [questions/support-user-indexes.md](../questions/support-user-indexes.md). | `@Index` em nível de propriedade e de classe. Composto, nomeado, `unique: true`, parcial via `where`. `@Unique` existe como decorator separado em nível de classe. |
| **Ordem de decorators** | ⏳ `@Column` / `@Nullable` independentes de ordem — cada decorator escreve seu bucket; `@Entity` os une. Circunscrito em [questions/decorator-order-independence.md](../questions/decorator-order-independence.md) (hoje `@Nullable` deve ser o interno). | Dependente de ordem no dialeto legado; `Reflect.metadata` mascara parte dos problemas de timing. |
| **Herança** | Single-Table Inheritance derivada da cadeia de protótipos: subclasses decoradas com `@Entity` herdam a tabela da raiz, com coluna discriminadora e índice auto-emitidos; escopo de leitura via `FindOptions.inheritance` (`ALL` / `ONLY` / `SUBCLASSES`). ([concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md)) | STI via `@TableInheritance({ column: { ... } })` + `@ChildEntity()`. Herança de tabela concreta também suportada via classe base abstrata. |
| **Relações** | `@ToOne(() => User)` com padrão thunk para grafos circulares. Tipo da coluna FK derivado da PK referenciada com **rebaixamento SERIAL → INTEGER** no nível de tipos. ([concepts/relations.md](../concepts/relations.md), [components/sql-types.md](../components/sql-types.md)) | `@ManyToOne`, `@OneToMany`, `@ManyToMany`, `@OneToOne` — matriz relacional completa; lazy/eager loading via opção `relations`. |
| **Escopo de banco** | PostgreSQL, profundamente. [Enum `COLUMN_TYPE`](../components/sql-types.md) fechado de 47 tipos PG; regras de tipos específicas de PG (rebaixamento de FK) fazem parte do contrato, não cola de adapter. | Abstração em formato de adapter sobre 11 bancos. Regras de tipos são achatadas ao mínimo denominador comum. |
| **Toolchain** | Só Bun. Suporte nativo a Stage-3, sem flags de decorator no `tsconfig`, `bun test` para TDD. ([ADR 0007](../decisions/0007-bun-toolchain.md)) | Node.js primário; Bun não é mencionado na documentação ou no getting-started. |

## A contribuição do OOR, dimensão por dimensão

### Dialeto de decorators

O TypeORM opera sob três constraints transitivas: a flag `experimentalDecorators`, a flag
`emitDecoratorMetadata` e um polyfill de runtime `reflect-metadata` que precisa carregar antes de
qualquer módulo decorado ser avaliado. Cada uma era razoável em 2018; em 2026 cada uma tem custos
que os autores originais não podiam evitar:

- As flags fixam uma forma de `tsconfig` que não é mais o default e caminha para status de
  "transicional".
- O polyfill patcheia um global. Num processo com múltiplas bibliotecas que usam decorators
  (TypeORM + DI do NestJS + Inversify é um stack comum), todas escrevem no mesmo registro
  `Reflect`.
- O dialeto está na trilha de deprecação relativa ao pipeline de padronização do TC39. O que os
  runtimes forem entregar nativamente na próxima década, não será este dialeto.

A postura Stage-3 do OOR remove as três constraints. O custo é uma decisão: tipos de coluna são
explícitos (`@Column({ type: COLUMN_TYPE.TEXT })`) em vez de inferidos de `design:type`. O enum
`COLUMN_TYPE` é fechado e pequeno o suficiente para isso não ser atrito na prática — e funciona
como documentação no call site.

Ver [stage-3-vs-legacy-decorators](stage-3-vs-legacy-decorators.md) para o mergulho profundo em
nível de dialeto.

### Segurança de SQL como propriedade de corretude

Esta é a contribuição mais forte do OOR. O caminho primário de composição do TypeORM *é* strings
SQL — até um `.where("user.id = :id", { id })` simples é um fragmento. A segurança depende de o
usuário escolher a forma de parâmetro nomeado em vez de concatenação de strings. A biblioteca
também entrega `repository.query()` como API crua de primeira classe.

O OOR proíbe o caminho inseguro inteiramente. O query builder usa um
[Conditions Proxy](../concepts/conditions-proxy.md) tipado — `cb.email!.eq(value)` em vez de
`"email = :email"` — então o usuário nunca escreve um fragmento SQL sequer. Identificadores
dinâmicos (nomes de tabela/coluna) passam por allowlists; `sql.unsafe` é banido no codebase
inteiro, inclusive nos internals da biblioteca. A classe de bugs de injeção que vai para
produção através de aplicações que usam ORM não consegue ir para produção através do OOR, por
construção.

Para um ORM acadêmico, esta é a contribuição que sobrevive mais tempo. Números de performance e
ergonomia de decorators são presos a versões; "você não consegue escrever uma SQL injection
através desta biblioteca" é uma propriedade do design.

### A fronteira Repository / QueryBuilder

O TypeORM oferece dois caminhos paralelos: `Repository.find(options)` (executa imediatamente,
casos simples) e `Repository.createQueryBuilder()` (lazy, casos compostos). Um consumidor precisa
saber em qual caminho está para cada tarefa, e os dois têm capacidades sobrepostas mas não
idênticas.

O OOR colapsa os dois: o `Repository<T>` é o ponto de entrada único. Métodos simples
(`findOne`, `findMany`, `findById`, `create`, `update`, `delete`) executam direto; a composição
mora no callback `where` (com o [conditions proxy](../concepts/conditions-proxy.md) tipado) e no
`FindOptions<T>` (`inheritance` para escopo STI). Um builder `QueryBuilder<T>` existe — com
`orderBy` / `limit` / `offset` fluentes — mas hoje é construído dentro dos métodos de leitura e
descartado após o terminal; não é entregue ao caller. A fronteira é unidirecional, sem sobre-
posição.

Este é o design a que a [ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md) se
compromete e que a página [concepts/lazy-query-builder.md](../concepts/lazy-query-builder.md)
documenta em detalhe.

### No-`any` estrito da superfície pública para dentro

`ObjectLiteral = { [key: string]: any }` está na costura de binding de parâmetros do TypeORM por
design — a biblioteca aceita objetos de parâmetro arbitrários para que fragmentos SQL escritos
pelo usuário possam referenciá-los por nome. É coerente, mas significa que `any` está no grafo de
tipos num ponto estrutural.

A política estrita de `@typescript-eslint/no-explicit-any` do OOR empurra erros para a IDE.
`create(entity: T)` rejeita entidades parciais em tempo de compilação, não em runtime via uma
violação de `NOT NULL`. Renomear uma coluna na classe da entidade quebra todo call site mal
escrito.

### PostgreSQL, profundamente

A manchete do TypeORM é "suporta mais bancos que qualquer outro ORM JS/TS". É uma proposta de
valor real para times com stacks heterogêneos, e um custo real para times que não os têm — toda
regra de tipo de coluna precisa se achatar ao mínimo denominador comum. Affordances específicos
de PG (`SERIAL`, `JSONB`, `TIMESTAMPTZ`, índices parciais, índices de expressão) viram escotilhas
em vez de tipos de primeira classe.

O enum `COLUMN_TYPE` do OOR é fechado, em formato PG, com 47 entradas. A regra de rebaixamento
de FK (`SERIAL → INTEGER` para uma coluna referenciando uma PK SERIAL) é codificada no nível de
tipos. Affordances específicos de PG viram primeira classe em vez de escotilhas.

É uma troca opinada — o universo de times beneficiados estreita — mas é a troca que deixa a
biblioteca afiada em vez de genérica. Para um TCC argumentando que o design de ORMs foi
sobre-generalizado, é uma escolha estrutural.

## Por que o OOR importa num mercado cheio

O TypeORM provou que ORMs TypeScript baseados em decorators funcionam. Também acumulou as
constraints de ter sido pioneiro: um dialeto de decorators transicional, um registro global de
metadados, strings SQL cruas como API primária de `where()`, `any` na costura de parâmetros e uma
matriz de bancos larga-mas-rasa. Cada uma dessas é uma resposta razoável a uma pergunta de 2018.
Nenhuma é uma resposta estrutural a uma pergunta de 2026.

A contribuição do OOR é a mesma forma com as constraints removidas: dialeto Stage-3, metadados
pertencentes à biblioteca, predicados tipados, superfície pública sem `any`, regras de tipos
específicas de PG. Cada uma é incremental sozinha; juntas formam um perfil ergonômico
significativamente diferente. É esse o caso que o TCC defende.

## Fontes

- Documentação do TypeORM: <https://typeorm.io>
- Repositório do TypeORM: <https://github.com/typeorm/typeorm>
- ADRs do OOR: [0001](../decisions/0001-stage-3-decorators.md),
  [0002](../decisions/0002-repository-with-lazy-query-builder.md),
  [0004](../decisions/0004-parameterized-sql-only.md),
  [0005](../decisions/0005-no-any-type-driven-api.md)
