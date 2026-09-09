# order-of-relations

ORM experimental para PostgreSQL escrito em TypeScript. O projeto usa decoradores ECMAScript Stage 3 para mapear classes a tabelas e oferece uma API tipada para criar esquemas e consultar ou persistir entidades.

## Objetivo

Reduzir o código repetitivo entre modelos TypeScript e tabelas PostgreSQL, mantendo o mapeamento e as consultas próximos das entidades da aplicação.

## Funcionalidades

- Mapeamento de entidades, colunas e chaves primárias com decoradores.
- Relações `ToOne`, incluindo chaves estrangeiras compostas e nulabilidade explícita.
- Criação e remoção de tabelas a partir dos metadados das entidades.
- Repositórios para criar, buscar, atualizar e remover registros.
- Consultas tipadas com filtros, ordenação, limite e deslocamento.
- Herança de entidades com discriminador e geração de chaves no cliente ou no banco.

## Tecnologias

- [TypeScript](https://www.typescriptlang.org/) com decoradores ECMAScript Stage 3.
- [Bun](https://bun.sh/) para execução, testes e acesso ao PostgreSQL.
- PostgreSQL como banco de dados.

## Requisitos

- Bun 1.3 ou superior.
- PostgreSQL acessível pela URL de conexão.

## Instalação e configuração

Instale as dependências:

```bash
bun install
```

Crie um arquivo `.env` na raiz do projeto com uma URL de conexão válida. O Bun a carrega automaticamente:

```env
DATABASE_URL=postgres://usuario:senha@localhost:5432/order_of_relations
```

## Executando

O projeto é uma biblioteca. Para ver um fluxo completo de criação de tabelas e operações CRUD, execute o exemplo abaixo. Ele recria as tabelas do exemplo, portanto use um banco de desenvolvimento:

```bash
bun examples/basic-crud/index.ts
```

O exemplo de herança pode ser executado da mesma forma:

```bash
bun examples/inheritance/index.ts
```

O ponto de partida para usar a biblioteca é definir uma entidade, conectar ao banco e criar um repositório:

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

@Entity(db, 'users')
class User {
  @PrimaryColumn({
    type: COLUMN_TYPE.SERIAL,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  name!: string;
}

db.connect();
await db.create();

const users = new Repository(User, db);
await users.create({ name: 'Alice' });
```

## Testes e verificações

Execute a suíte de testes:

```bash
bun test
```

Execute também as verificações estáticas e de estilo:

```bash
bun run typecheck
bun run lint
```

Os testes que acessam o banco também exigem `DATABASE_URL` configurada.

## Arquitetura

Os decoradores registram metadados das entidades. `Database` usa esses metadados para abrir a conexão e criar ou remover o esquema. `Repository` e `QueryBuilder` executam operações de persistência e consulta sobre as entidades registradas.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Diagrama de classes](docs/class-diagram.md)
- [Convenções de documentação no código](docs/code-documentation.md)
- [Guia de contribuição](CONTRIBUTING.md)
