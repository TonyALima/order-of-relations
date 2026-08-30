# Examples

Os cenários executáveis em `examples/` — as demonstrações canônicas, dentro do repo, de como a
API é realmente chamada. Cada cenário é autocontido: `db.ts` + `entities/` + `services/` +
`index.ts`.

## `examples/basic-crud/`

O **cenário CRUD mínimo viável.** A menor demonstração ponta a ponta: uma entidade, um
repositório, três métodos do Repository.

| Decorator / API | Arquivo |
| --- | --- |
| `@Entity(db)` | `examples/basic-crud/entities/User.ts` |
| `@PrimaryColumn({ type: SERIAL, autogeneration: { dbSide: () => undefined } })` | `examples/basic-crud/entities/User.ts` |
| `@Column @NotNullable` | `examples/basic-crud/entities/User.ts` |
| `new Repository(User, db)` (sem DI ainda) | `examples/basic-crud/services/UserService.ts` |
| `repo.create(entity)` | `examples/basic-crud/services/UserService.ts` |
| `repo.findById(key)` | `examples/basic-crud/services/UserService.ts` |
| `repo.findMany(options?)` | `examples/basic-crud/services/UserService.ts` |
| Wiring `db.connect()` + `db.create()` | `examples/basic-crud/db.ts`, `examples/basic-crud/index.ts` |

`User` é o "User" canônico que o resto da documentação menciona. Quando uma página diz "imagine
uma entidade `User`", este é o arquivo real.

**O que não cobre:** herança (ver `examples/inheritance`), relações, o campo `inheritance` de
`FindOptions`, e DI / `@Service` / `@InjectRepository` — esses decorators ainda não estão
implementados (ver [ADR 0003](decisions/0003-singleton-di-container.md)); o serviço constrói seu
repositório diretamente.

Leituras relacionadas: [components/repository.md](components/repository.md),
[concepts/autogeneration.md](concepts/autogeneration.md),
[architecture.md — lifecycle de um create](architecture.md#lifecycle-de-um-create).

## `examples/inheritance/`

Cenário de single-table inheritance com `User` e `AdminUser extends User`. **O único lugar do
codebase que demonstra o campo `inheritance` de `FindOptions` em uso.**

| Decorator / API | Arquivo |
| --- | --- |
| `@Entity(db) class User` (a raiz STI) | `examples/inheritance/entities/User.ts` |
| `@Entity(db) class AdminUser extends User` (a subclasse) | `examples/inheritance/entities/AdminUser.ts` |
| `findMany({ inheritance: InheritanceSearchType.SUBCLASSES })` | `examples/inheritance/services/UserHierarchyService.ts` — `listSubClassUsers()` e `listSubClassAdmins()` |
| `findMany()` puro (default `ALL`) — lê toda linha da tabela herdada | `examples/inheritance/services/UserHierarchyService.ts` |
| Um repositório por tipo de subclasse (`new Repository(User, db)`, `new Repository(AdminUser, db)`) | `examples/inheritance/services/UserHierarchyService.ts` |
| `db.create()` emitindo DDL STI — `CREATE TABLE` + `ALTER ADD COLUMN discriminator` + `CREATE INDEX idx_discriminator` | `examples/inheritance/db.ts`, `examples/inheritance/index.ts` |

**O que ler primeiro:** `examples/inheritance/services/UserHierarchyService.ts`. Toda alegação
desta documentação sobre `InheritanceSearchType.SUBCLASSES` remonta aos seus métodos
`listSubClassUsers()` / `listSubClassAdmins()`.

Leituras relacionadas:
[concepts/single-table-inheritance.md](concepts/single-table-inheritance.md),
[components/query-builder.md](components/query-builder.md) (§ `applyOptions()`),
[architecture.md — schema create/drop](architecture.md#schema-createdrop) (§ emissões STI).

## `examples/relations/` — lacuna

O cenário de `@ToOne` / relações **não existe ainda** — o diretório está vazio. Quando for
escrito, deve demonstrar:

- `@ToOne(() => Target)` com a referência de alvo em closure (ver
  [concepts/relations.md](concepts/relations.md)).
- Derivação automática de nomes de coluna FK (`propriedadeDaRelacao + '_' + propriedadePkDoAlvo`).
- O rebaixamento SERIAL→INTEGER de tipo de FK quando a PK do alvo é `SERIAL` (ver
  [components/sql-types.md](components/sql-types.md)).
- A emissão de schema em duas passagens: `CREATE TABLE` para as duas entidades primeiro, depois
  `ALTER TABLE ... ADD FOREIGN KEY` (ver
  [architecture.md — schema create/drop](architecture.md#schema-createdrop)).
