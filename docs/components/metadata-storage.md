# MetadataStorage

Módulo: `src/core/metadata/` · Exporta os tipos `EntityMetadata`, `ColumnMetadata`,
`RelationMetadata` pelo barrel público

## Propósito

`MetadataStorage` guarda as descrições de entidade já resolvidas de um único `Database` — a forma
estruturada do que os decorators escrevem. É a **única** camada que
[Repository](repository.md) e [QueryBuilder](query-builder.md) leem ao planejar queries ou compor
DDL.

## Forma

Um único `Map<Constructor, EntityMetadata>`, chaveado pela **identidade de referência** do
construtor (não por string de nome), mais uma flag de resolução (`isMetadataResolved`).

`EntityMetadata` agrega exatamente quatro coisas:

```ts
interface EntityMetadata {
  tableName: string;        // default: nome da classe; resolvido contra a cadeia de protótipos
  discriminator?: string;   // presente só em hierarquias STI com 2+ classes
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
}
```

```ts
interface ColumnMetadata {
  propertyName: string;
  columnName: string;
  type: COLUMN_TYPE;
  primary?: boolean;
  nullable: boolean;
  autogeneration?: Autogeneration<unknown>;
}

interface RelationMetadata {
  propertyName: string;
  relationType: RelationType;   // TO_ONE (TO_MANY definido, não implementado)
  nullable: boolean;
  columns: { name: string; type: COLUMN_TYPE; referencedProperty: string }[] | null;
  getTarget: () => Constructor; // thunk — ver concepts/relations.md
}
```

Nomes de schema declaráveis, índices de usuário e regras de cascade estão deliberadamente
ausentes — pertenceriam ao mesmo registro, mas ainda não são necessários. Adicionar campos depois
é mais barato que remover.

> **Um índice implícito, mas real, pertencente ao schema-create.** Tabelas STI ganham um índice
> implícito `idx_discriminator` adicionado por `Database.create()` (junto à coluna
> discriminadora). Não é declarável pelo usuário nem modelado aqui — vive inteiramente no caminho
> de criação de schema.

### Por que `Map`, e não statics por classe ou `WeakMap`

- **Statics por classe** espalhariam metadados pelo código do usuário. O `Map` mantém a posse
  dentro da biblioteca.
- **`Symbol.iterator`** faz parte da superfície pública — geradores de schema e o resolvedor de
  herança percorrem todas as entidades registradas.
- **`WeakMap` seria um bug.** O OOR quer as classes de entidade vivas pelo tempo de vida da
  conexão — o registro *é* o schema. Uma referência fraca deixaria entidades serem coletadas sob
  pressão de GC.

## Posse

> **Um por `Database`, não um por processo.** `MetadataStorage` pertence a uma instância de
> `Database`. `@Entity(db)` recebe o banco como argumento e registra a entidade no storage
> **daquele banco**. Duas instâncias de `Database` no mesmo processo = dois mapas independentes.

## Caminho de escrita (só decorators)

Nada fora de `src/decorators/` chama `MetadataStorage.set`. O caminho de escrita usa **três**
chaves-símbolo no bag `context.metadata` do Stage-3, cada uma com uma forma:

| Chave | Forma | Escrita por | Lida por |
| --- | --- | --- | --- |
| `COLUMNS_KEY` | `ColumnMetadata[]` | `@Column`, `@PrimaryColumn` | `@Entity` |
| `RELATIONS_KEY` | `RelationMetadata[]` | `@ToOne` | `@Entity` |
| `NULLABLE_KEY` | `Map<string, boolean>` | `@Nullable`, `@NotNullable` | `@Column` (par-a-par; nunca chega ao storage) |

O fluxo:

1. Decorators de campo rodam (em ordem de baixo para cima no fonte; o decorator mais interno roda
   primeiro). `@Nullable` / `@NotNullable` gravam `NULLABLE_KEY[propertyName] = true | false`.
   `@Column` então lê essa entrada — e lança `MissingNullabilityDecoratorError` se ela faltar —
   antes de empilhar o `ColumnMetadata` (já com `nullable` resolvido) em `COLUMNS_KEY`.
   `@PrimaryColumn` pula a verificação de `NULLABLE_KEY` e força `nullable: false`.
2. `@Entity(db, mapTableName?)` roda por último (decorators de classe rodam depois dos de campo,
   pela especificação da linguagem). Ele puxa `COLUMNS_KEY` e `RELATIONS_KEY` de
   `context.metadata`, exige ao menos uma coluna `primary` (`MissingPrimaryColumnError` se não
   houver), monta um `EntityMetadata` e o grava em `db.getMetadata()`.

Ver [architecture.md — registro de entidade](../architecture.md#registro-de-entidade) para a
sequência passo a passo.

Depois que todas as declarações de classe foram avaliadas, o storage fica **congelado pelo tempo
de vida do processo** — nenhum outro caminho de código o muta.

## Caminho de leitura e resolução lazy

`isMetadataResolved` é a flag de laziness. Todo `set()` a reseta para `false`. O próximo `get()`
(ou iteração) dispara duas passagens de resolução:

- **`resolveInheritance`** — para cada classe registrada, sobe por
  `Object.getPrototypeOf(target.prototype)?.constructor` até o ancestral decorado mais alto e
  adota seu `tableName`. Cadeias de vários níveis colapsam em uma tabela. Discriminadores são
  atribuídos por classe e depois **apagados** se apenas uma classe mapeia para uma dada tabela;
  um irmão registrado depois os restaura na próxima passagem de resolução. Ver
  [concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md).
- **`resolveRelations`** — para cada `RelationMetadata`, chama o thunk `getTarget()` e procura o
  resultado no storage. Se o alvo não estiver registrado, lança `RelationTargetNotFoundError`.
  Nomes de colunas FK que os decorators deixaram `null` são preenchidos aqui
  (`<propriedade>_<pkDoAlvo>`), e os **tipos** das colunas FK são derivados chamando
  `toForeignKeyType` em cada coluna PK do alvo — SERIAL/SMALLSERIAL/BIGSERIAL são rebaixados para
  os tipos inteiros subjacentes (ver [components/sql-types.md](sql-types.md)).

Depois das passagens, `isMetadataResolved = true`. Leituras subsequentes batem no cache
resolvido.

O design flag-e-reset torna a resolução **idempotente diante de adições tardias** — registrar uma
classe irmã não corrompe entradas já resolvidas; a próxima leitura recomputa o que precisa
mudar.

## Por que importa

- **Decorators ficam estreitos.** Escrevem dados por-classe em `context.metadata`, nunca
  diretamente no `MetadataStorage`. Só `@Entity` despeja o buffer.
- **Resolução lazy e idempotente.** Decorators não precisam raciocinar sobre ordem de declaração;
  a resolução acontece na primeira leitura após todas as classes carregarem.
- **Posse por-`Database`** torna o isolamento de testes trivial: cria-se um `Database` novo,
  registram-se entidades nele, e o resto do processo não é tocado.

## Modos de falha

| Onde | Erro | Notas |
| --- | --- | --- |
| `@Entity` | `MissingPrimaryColumnError` | Lançado em tempo de decoração se nenhuma coluna tem `primary: true`. A classe nunca chega ao storage. |
| `@Column` (lendo `NULLABLE_KEY`) | `MissingNullabilityDecoratorError` | Lançado em tempo de decoração se `@Nullable`/`@NotNullable` não foi aplicado antes (como decorator interno). `@PrimaryColumn` é isento. |
| `resolveRelations` | `RelationTargetNotFoundError` | Lançado quando o thunk `getTarget()` retorna um construtor nunca registrado. Carrega o nome da classe alvo e o caminho da relação (ex.: `posts.author`). |
| `storage.get(ClasseNaoRegistrada)` | *(nenhum — retorna `undefined`)* | Deliberado: "sem entrada" pode significar "esqueceu `@Entity`" ou "classe errada"; a camada de metadados não consegue desambiguar. Traduzir isso em erro para o usuário é trabalho do repositório. |

## Conexões

- [Database](database.md) — dono do storage.
- [concepts/stage-3-decorators.md](../concepts/stage-3-decorators.md) — o recurso de linguagem
  cujo `context.metadata` serve de buffer de escrita.
- [concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md) — o que
  `resolveInheritance` produz.
- [concepts/relations.md](../concepts/relations.md) — o padrão de thunk que `resolveRelations`
  invoca.
