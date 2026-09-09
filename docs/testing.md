# Guia de testes

Este documento descreve a estratégia e as convenções usadas para testar
`order-of-relations`. A suíte usa a API [`bun:test`](https://bun.sh/docs/test/writing-tests)
e deve validar comportamentos e contratos observáveis, não detalhes internos de
implementação. A decisão que adotou o ciclo de desenvolvimento e a organização
por escopo está registrada no [ADR-0006](adr/0006-ritmo-tdd-e-organizacao-dos-testes.md).

## Estratégia

### Testes unitários

Os testes unitários ficam próximos do código em `src/`, em arquivos `*.test.ts`.
Eles cobrem regras isoladas de metadados, decoradores, erros, repositórios e
construção de consultas. Cada teste cria os objetos de que precisa; quando a
operação precisa executar SQL sem validar o dialeto PostgreSQL, usa uma conexão
SQLite em memória ou um `spyOn` sobre uma dependência controlada.

O objetivo desse nível é verificar contratos locais, como os metadados gerados
por um decorador, a consulta construída, a transformação de resultados e a
hierarquia de erros. Ele não substitui a validação do SQL e do esquema no
PostgreSQL.

### Testes de integração

Os testes de integração ficam em `tests/` e exercitam a API pública com
entidades, `Database` e `Repository` reais. Eles cobrem CRUD, relações e
geração de chaves. Há também cenários dependentes de PostgreSQL em
`src/core/database/database.test.ts`, mantidos junto ao componente que produz
o esquema.

Como PostgreSQL é o banco suportado pela biblioteca, qualquer comportamento
específico de esquema, chave estrangeira, `DEFAULT` ou tipo SQL deve ser
validado nesse nível contra PostgreSQL. SQLite em memória é apenas um recurso
de isolamento para cenários locais; ele não amplia os bancos suportados pela
biblioteca.

### Testes E2E

O projeto não possui testes E2E no momento. A biblioteca não expõe uma
interface HTTP, CLI ou gráfica própria; seus fluxos públicos completos são
cobertos pelos testes de integração. Um nível E2E só deve ser adicionado quando
houver uma interface externa concreta para exercitar.

## Organização

```text
src/
├── core/
│   ├── database/
│   │   ├── database.ts
│   │   └── database.test.ts
│   ├── metadata/
│   │   ├── metadata.ts
│   │   └── metadata.test.ts
│   └── repository/
│       ├── repository.ts
│       └── repository.test.ts
├── decorators/
│   └── <decorator>/<decorator>.test.ts
└── query-builder/
    └── query-builder.test.ts
tests/
├── crud.test.ts
├── relations.test.ts
└── autogeneration.test.ts
```

Crie um teste unitário ao lado do módulo que ele cobre. Crie um teste em
`tests/` quando o cenário percorrer mais de um componente público ou precisar
de PostgreSQL. Não duplique um mesmo comportamento nos dois níveis: o unitário
deve explicar a regra local e o de integração deve provar que a colaboração
entre os componentes funciona.

## Nomes

- Arquivos usam o sufixo `.test.ts`, com o mesmo nome do módulo testado quando
  estão em `src/`; em `tests/`, usam o assunto do fluxo, como
  `relations.test.ts`.
- `describe` nomeia o componente ou o cenário, por exemplo
  `Repository` ou `Integration: Relations CRUD`.
- `test` descreve o comportamento e o resultado esperado, em vez de a chamada
  interna realizada: `findById() returns null when no row matches` é preferível
  a `calls buildWhere()`.
- Dados de teste devem ter nomes legíveis e locais ao teste, como `user`,
  `profile` e `expectedColumns`. Não há diretório compartilhado de fixtures
  hoje; extraia uma fixture somente depois de haver reutilização concreta e
  nomeie o arquivo `<domain>.fixture.ts`.
- Não há mocks ou helpers compartilhados hoje. Quando forem necessários em mais
  de um arquivo, use os sufixos `.test-helper.ts` e nomes que revelem o papel,
  como `connectionSpy` ou `createUserFixture`.

## Estrutura de um caso

Use `describe`, `test` e `expect` de `bun:test`. Organize cada caso em
Arrange / Act / Assert quando isso tornar o fluxo mais claro:

```ts
import { describe, expect, test } from 'bun:test';
import { MetadataStorage } from './metadata';
import { COLUMN_TYPE } from '../sql-types/sql-types';

describe('MetadataStorage', () => {
  test('returns metadata previously stored for an entity', () => {
    // Arrange
    const storage = new MetadataStorage();
    class User {}
    storage.set(User, {
      tableName: 'users',
      columns: [
        {
          propertyName: 'id',
          columnName: 'id',
          type: COLUMN_TYPE.SERIAL,
          primary: true,
          nullable: false,
        },
      ],
      relations: [],
    });

    // Act
    const metadata = storage.get(User);

    // Assert
    expect(metadata?.tableName).toBe('users');
  });
});
```

Prefira matchers específicos, como `toHaveLength`, `toBeNull` e
`toBeInstanceOf`. Para promessas que devem falhar, aguarde a asserção com
`await expect(promise).rejects...`; para cenários repetidos, use `test.each`
com títulos que identifiquem cada caso. Os hooks `beforeEach` e `afterEach`
devem manter o estado isolado; `beforeAll` e `afterAll` servem apenas a
recursos compartilhados por uma suíte.

## Mocks, fixtures e dependências

Prefira implementações reais quando forem pequenas e determinísticas. Os
testes atuais usam `SQL` com SQLite em memória para executar consultas e
`spyOn` para isolar o ponto de acesso à conexão quando o comportamento em foco
não é o banco.

Use um mock ou spy somente para controlar uma dependência que tornaria o teste
lento, não determinístico ou fora do escopo. As asserções devem observar o
resultado público da operação; não teste chamadas internas sem que a interação
seja o próprio contrato. Serviços externos não devem ser acessados pelos testes
unitários. Se um serviço externo passar a integrar um fluxo, cubra sua
integração em ambiente controlado, com credenciais e dados exclusivos para
teste.

## Banco de dados e isolamento

O Bun carrega `.env` automaticamente. Os cenários PostgreSQL exigem
`DATABASE_URL`, por exemplo:

```env
DATABASE_URL=postgres://usuario:senha@localhost:5432/order_of_relations
```

Use um banco de desenvolvimento exclusivo: os testes de integração criam e
removem as próprias tabelas com `Database.create()` e `Database.drop()`. Eles
não usam migrations nem seeds, pois o esquema é derivado dos decoradores das
entidades de teste. Nunca execute a suíte contra um banco com dados
importantes.

Cada caso deve preparar e limpar o próprio estado. Use uma conexão SQLite nova
em `beforeEach` para testes em memória; nos cenários PostgreSQL, recrie o
esquema no hook apropriado e remova-o em `afterEach` ou `afterAll`. Um teste não
deve depender da ordem de execução nem dos dados deixados por outro.

## Erros e limites

Todo comportamento alterado deve ter casos para o caminho esperado e para as
falhas relevantes. Conforme o contrato em questão, cubra entradas inválidas,
ausência de registros, nulabilidade, chaves primárias compostas incompletas,
relações sem destino registrado e erros retornados pelo banco. Para erros da
biblioteca, verifique também a classe concreta e sua cadeia de herança quando
ela fizer parte do contrato público.

## Execução

Instale as dependências e configure `DATABASE_URL` antes de rodar a suíte
completa:

```bash
bun install

# Todos os testes, inclusive os que usam PostgreSQL
bun test

# Um arquivo ou um comportamento específico
bun test src/core/metadata/metadata.test.ts
bun test --test-name-pattern='RelationTargetNotFoundError'

# Relatório de cobertura no terminal
bun test --coverage
```

`bun test --coverage` usa o relatório nativo do Bun; arquivos de teste são
excluídos por padrão. O repositório não configura limite mínimo, relatório
persistente ou comando separado de cobertura. Use a cobertura para encontrar
comportamentos sem teste, nunca como substituto de asserções significativas.

Após uma alteração de código, execute também:

```bash
bun run typecheck
bun run lint
```

## Integração contínua

Não há configuração de CI versionada no repositório no momento. Portanto, não
existem verificações automáticas de testes ou cobertura em eventos de push e
pull request. Até que uma pipeline seja adicionada, a execução local de `bun
test`, `bun run typecheck` e `bun run lint` é a verificação esperada antes de
integrar uma alteração.

## Diretrizes

- Mantenha os testes independentes, determinísticos e legíveis.
- Faça testes falharem antes da implementação ao alterar comportamento e
  mantenha a suíte verde ao final.
- Valide contratos e resultados observáveis, não a implementação incidental.
- Dê aos casos de erro e de limite a mesma atenção dispensada ao fluxo
  principal.
- Não deixe `test.only`, `test.skip` ou `test.todo` como forma de ocultar uma
  falha.
