# Arquitetura

## Visão geral

`order-of-relations` é uma biblioteca ORM para PostgreSQL. Ela concentra o
mapeamento junto às classes de entidade: decoradores ECMAScript Stage 3
registram metadados em uma instância de `Database`; essa instância usa os
metadados para criar ou remover o esquema e para executar persistência e
consultas tipadas.

```text
Aplicação
    │ define entidades e instancia repositórios
    ▼
Decoradores ─────► MetadataStorage ◄──── Database
                            │                 │
                            ▼                 ▼
                    Repository ───────► QueryBuilder
                            │                 │
                            └────────┬────────┘
                                     ▼
                              Bun SQL / PostgreSQL
```

As entidades pertencem à instância de `Database` recebida por `@Entity`.
Portanto, os metadados e a conexão não são globais: aplicações ou testes podem
manter conjuntos de entidades independentes usando instâncias diferentes.

## Componentes e responsabilidades

### Entidades e decoradores

As entidades são classes TypeScript anotadas com `@Entity`, `@Column`,
`@PrimaryColumn`, `@Nullable`, `@NotNullable` e, quando necessário, `@ToOne`.
Os decoradores descrevem tabela, colunas, chave primária, nulabilidade e
relações nos metadados da classe. Eles também validam requisitos do
mapeamento, como a presença de uma chave primária e a nulabilidade explícita
de campos comuns e relações.

Esse nível define o mapeamento; ele não abre conexões, cria tabelas nem emite
consultas. A escolha pelos decoradores ECMAScript Stage 3 e pelo armazenamento
próprio dos metadados é registrada no
[ADR-0001](adr/0001-decoradores-ecmascript-stage-3.md).

### Metadados

`MetadataStorage` mantém o mapeamento das entidades registradas em cada
`Database`. Antes de o mapeamento ser consumido, ele resolve relações `ToOne`
e herança. Relações recebem colunas de chave estrangeira a partir das chaves
primárias da entidade alvo, inclusive quando a chave é composta. Na herança,
as subclasses compartilham a tabela da entidade base e recebem um
discriminador.

Os metadados são a fronteira entre a declaração por decoradores e a execução
do ORM. Eles não armazenam registros da aplicação nem substituem o PostgreSQL
como fonte de dados.

### Database e esquema

`Database` possui a conexão `SQL` do Bun e seu `MetadataStorage`. `connect()`
abre a conexão usando a URL informada ou `DATABASE_URL`; `create()` cria as
tabelas, chaves primárias, discriminadores e chaves estrangeiras registrados;
`drop()` remove as tabelas em uma ordem compatível com suas dependências.

O componente gera o esquema inicial a partir do mapeamento. Ele não é um
sistema de migrações, não gerencia mais de um banco por instância e não expõe
uma camada de transação da aplicação.

### Repository

`Repository<T>` fornece as operações de persistência para uma entidade:
criação, busca por chave, busca única ou múltipla, atualização e remoção. Ele
traduz propriedades da entidade, chaves primárias e relações `ToOne` em
colunas e delega as buscas ao `QueryBuilder`.

O repositório não contém regras de negócio, orquestração de casos de uso ou
hidratação automática de grafos de relações. Essas responsabilidades continuam
na aplicação consumidora.

### QueryBuilder

`QueryBuilder<T>` constrói consultas `SELECT` tipadas para uma entidade. Ele
aceita filtros por coluna, ordenação, limite, deslocamento e o escopo de
herança. O construtor converte as condições em fragmentos SQL parametrizados e
executa a consulta pela conexão da instância de `Database`.

Ele não representa uma linguagem SQL completa: o escopo atual não inclui
joins, seleção parcial de colunas, agregações ou carregamento de relações.

### Integração SQL

A única integração de infraestrutura é `SQL` do Bun, usado para compor
fragmentos parametrizados e se conectar ao PostgreSQL. O PostgreSQL é a única
base suportada; tipos de coluna, geração no banco, tabelas, restrições e
consultas seguem esse modelo.

Valores de entidades e filtros são vinculados por templates `sql`. Nomes de
tabela e coluna são identificadores, não parâmetros: eles vêm dos metadados e
passam pelo helper `sql(nome)` do Bun. Tipos de DDL, operadores e direções são
fragmentos fechados definidos pelo ORM. A criação de esquema não usa
parâmetros de valores; a instrução composta de herança usa `.simple()`, cujo
protocolo não aceita parâmetros. `sql.unsafe` é proibido em todos esses
caminhos, conforme o [ADR-0004](adr/0004-sql-parametrizado.md).

## Fluxos principais

### Registro e criação do esquema

1. A aplicação cria um `Database` e declara entidades com `@Entity(db)`.
2. Os decoradores registram colunas e relações nos metadados da entidade.
3. A aplicação chama `db.connect()` e `db.create()`.
4. `Database` resolve os metadados, cria as tabelas e depois adiciona as
   chaves estrangeiras `ToOne`.

### Persistência

1. A aplicação instancia `Repository` para uma entidade e chama `create()`,
   `update()` ou `delete()`.
2. O repositório valida a presença da chave primária quando a operação exige
   uma, aplica geração de chave no cliente quando configurada e transforma
   relações `ToOne` em valores de chave estrangeira.
3. A operação é emitida ao PostgreSQL por meio de templates SQL
   parametrizados do Bun.
4. Em `create()`, as chaves primárias retornadas pelo banco são devolvidas à
   aplicação.

### Consulta

1. A aplicação chama `findMany()`, `findOne()` ou `findById()` no repositório,
   opcionalmente com filtros, ordenação, paginação e escopo de herança.
2. O repositório cria um `QueryBuilder`, que usa os metadados para mapear as
   propriedades para colunas e acrescentar o filtro de discriminador quando
   aplicável.
3. O `QueryBuilder` executa o `SELECT` parametrizado no PostgreSQL e retorna
   as linhas como entidades tipadas.

## Relação com ADRs

As decisões arquiteturais relevantes são registradas como
[ADRs](adr/README.md). Este documento registra somente seus efeitos na
arquitetura; cada ADR preserva o contexto, as alternativas e a justificativa
da decisão.

O [ADR-0002](adr/0002-repository-query-builder-boundary.md) define a
fronteira entre a fachada pública `Repository` e o `QueryBuilder` interno.

Para a estrutura de classes e tipos do código, consulte o
[diagrama de classes](class-diagram.md).
