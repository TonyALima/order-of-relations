# Single-Table Inheritance (STI)

## Definição

**Single-table inheritance (STI)** mapeia uma hierarquia de classes para uma *única* tabela SQL,
distinguindo linhas por uma coluna **discriminadora**. No OOR, STI emerge automaticamente das
cadeias de protótipos: subclasses herdam o nome de tabela do pai, e discriminadores são
atribuídos (ou apagados) conforme existam ou não classes irmãs.

A resolução acontece lazy, dentro do [MetadataStorage](../components/metadata-storage.md), na
primeira leitura após um `set()`.

## Como funciona

Quando o MetadataStorage resolve herança:

1. **Caminha pela cadeia de protótipos.** Para cada construtor registrado `C`, segue
   `Object.getPrototypeOf(C.prototype)?.constructor` para cima até alcançar uma classe que
   **não** é decorada com `@Entity`. O ancestral decorado mais profundo é a **raiz** da
   hierarquia.
2. **Adota o nome de tabela da raiz.** Toda classe da cadeia — `Base ← User ← AdminUser` — recebe
   o nome de tabela da classe decorada mais alta. Cadeias de vários níveis colapsam numa tabela
   só.
3. **Atribui um discriminador.** Por default, o discriminador de cada classe é *o nome de tabela
   que ela mesma declarou* (o valor para o qual `mapTableName` resolveu no `@Entity`).
4. **Apaga singletons.** Se apenas uma classe mapeia para uma dada tabela, seu discriminador é
   limpo — nenhuma coluna discriminadora é necessária quando não há nada para discriminar. Assim
   que uma classe irmã se registra e a resolução reroda, ambas recuperam seus discriminadores.

A resolução é controlada por `isMetadataResolved`. A flag é resetada a cada `set()`, então
adicionar uma entidade nova invalida o cache e a próxima leitura recomputa — idempotentemente.

## Lendo através da hierarquia

A API de usuário para leituras STI é o campo `inheritance` de `FindOptions<T>`, apoiado no enum
fechado `InheritanceSearchType`:

```ts
import { InheritanceSearchType } from 'order-of-relations';

const userRepo = new Repository(User, db);
const adminRepo = new Repository(AdminUser, db);

// Default (ALL): toda linha da tabela User — linhas de User E de AdminUser.
await userRepo.findMany();

// ONLY: só linhas cujo discriminador casa exatamente com a entidade.
await userRepo.findMany({ inheritance: InheritanceSearchType.ONLY });

// SUBCLASSES: linhas desta entidade mais as de todos os descendentes, tipadas como T.
await userRepo.findMany({ inheritance: InheritanceSearchType.SUBCLASSES });
```

| Valor | Predicado adicionado | Significado |
| --- | --- | --- |
| `ALL` | (nenhum) | Lê toda linha da tabela herdada; o caller assume a responsabilidade pelas linhas de irmãos. |
| `ONLY` | `discriminator = <self>` | Só linhas de `T`. |
| `SUBCLASSES` | `discriminator IN (...)` | `T` mais todo descendente descoberto pela caminhada de protótipos. |

A regra discriminador-só-quando-necessário continua valendo: se `T` está sozinho na tabela
(nenhum irmão registrado ainda), `meta.discriminator` é `undefined` e nenhum predicado é emitido
— `findMany({ inheritance: ONLY })` é no-op em nível de SQL. Assim que um irmão se registra e os
metadados re-resolvem, a mesma chamada passa a filtrar.

`examples/inheritance/services/UserHierarchyService.ts` é a demonstração canônica — ver
[examples.md](../examples.md).

## Por que importa

- **Schema compartilhado, tipos distintos.** `User` e `AdminUser` vivem na mesma tabela `User`;
  queries contra qualquer um dos tipos projetam sobre as mesmas linhas, distinguidas pelo
  discriminador.
- **Sem caminhada de hierarquia em tempo de query.** A resolução acontece uma vez (por delta de
  registro); o query builder lê um `EntityMetadata` já resolvido e não repete a caminhada.
- **Herança de colunas é grátis.** Stage-3 não mescla arrays de colunas através da hierarquia —
  mas os metadados do pai já estão no storage sob o construtor do pai, então o resolvedor de
  herança simplesmente lê de lá. Sem duplicação, sem síntese.
- **Idempotente diante de adições tardias.** Registrar um irmão mais tarde na sequência de carga
  não corrompe entradas já resolvidas — o padrão flag-e-reset cuida disso.

## Exemplos

```ts
@Entity(db) // decorator => tabela 'User' (ou o nome da classe)
class User {
  /* @PrimaryColumn id, @Column email, ... */
}

@Entity(db)
class AdminUser extends User {
  /* @Column adminLevel */
}
```

Após a resolução:

| Classe | Tabela | Discriminador |
| --- | --- | --- |
| `User` | `User` | `'User'` |
| `AdminUser` | `User` | `'AdminUser'` |

Se apenas `User` estivesse registrado, seu discriminador seria **vazio** (nenhum irmão para
desambiguar). Quando `AdminUser` se registra e a próxima leitura dispara a re-resolução, ambos
ganham seus discriminadores.

Para uma cadeia de vários níveis `Base ← User ← AdminUser`, as três colapsam na tabela de
`Base`; o discriminador de cada uma é seu próprio nome de classe.

## O que o schema-create emite

Para uma raiz STI com discriminador truthy, `Database.create()` emite três statements na passagem
de tabelas-base:

1. `CREATE TABLE <root> (<columns>, PRIMARY KEY (...))`
2. `ALTER TABLE <root> ADD COLUMN discriminator TEXT NOT NULL;`
3. `CREATE INDEX idx_discriminator ON <root>(discriminator);`

Entidades de subclasse — cujo `tableName` foi reescrito para o da raiz durante
`resolveInheritance`, de modo que `discriminator !== tableName` — são **puladas** na passagem de
tabelas-base. Só a raiz produz DDL; as subclasses apenas contribuem suas colunas para a tabela da
raiz via os metadados resolvidos por herança.

O índice `idx_discriminator` é compartilhado por toda tabela STI do schema (mesmo nome em todos).
Com uma hierarquia, tudo bem; duas hierarquias coexistindo colidiriam no nome duplicado do
índice — ver [questions/idx-discriminator-collision.md](../questions/idx-discriminator-collision.md).

## Armadilhas

- **A raiz precisa ser decorada.** A caminhada para no primeiro ancestral sem `@Entity`. Um
  `BaseEntity` não decorado é tratado como "não faz parte da hierarquia" — `User extends
  BaseEntity` mapearia para a tabela `User`, não `BaseEntity`.
- **O discriminador pode virar de ausente para presente.** Uma classe pode não ter discriminador
  no início da ordem de carga e ganhar um quando um irmão se registra. Código que cacheia
  `EntityMetadata` fora do loop de resolução do MetadataStorage verá dados velhos.
- **Colisões de coluna entre irmãos não são detectadas aqui.** `User.email` e `AdminUser.email`
  escreveriam ambos na coluna `User.email` sem lógica de merge — a camada de metadados não valida
  unicidade de colunas entre irmãos.

## Conexões

- [MetadataStorage](../components/metadata-storage.md) — dono da flag de resolução e do `Map`.
- [stage-3-decorators.md](stage-3-decorators.md) — `context.metadata` *não* é herdado entre
  declarações de subclasse; é isso que torna a caminhada de protótipos necessária em tempo de
  resolução, e não de decoração.
- [components/query-builder.md](../components/query-builder.md) — `applyOptions()` e os helpers
  de discriminador.
