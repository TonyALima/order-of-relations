# O OOR deveria implementar suporte a relações `@ManyToMany`?

> Status: **aberta** (sem decorator; sem maquinaria de tabela de junção; depende de
> [support-one-to-many](support-one-to-many.md)) · Impacto: **médio** · Esforço: **G**

## Questão

O OOR não tem como expressar uma relação many-to-many. O único decorator de relação existente é
`@ToOne` (`src/decorators/relation/relation.ts`); os únicos membros do enum são `TO_ONE` e
`TO_MANY` — nenhum descreve o caso M:N explicitamente. Deveríamos entregar um decorator
`@ManyToMany` que (a) introduz uma terceira categoria de metadados, (b) emite uma tabela de
junção sintetizada em tempo de schema-create, e (c) trata da semântica bidirecional de
leitura/escrita que vem com M:N?

## Por que importa

- **M:N é uma das três formas canônicas de relação.** Sistemas de tags, atribuições de papéis,
  matrículas em cursos, grafos de amizade — todo schema de aplicação não trivial tem pelo menos
  um. Sem `@ManyToMany`, consumidores do OOR caem no fallback de declarar manualmente a entidade
  de junção (`User`, `Tag`, *e* `UserTag`), as três com decorators `@ToOne` explícitos.
  Funcionável, verboso, e expõe infraestrutura que deveria ficar implícita.
- **É o desdobramento natural de [support-one-to-many](support-one-to-many.md).** O padrão
  clássico de ORM decompõe M:N em duas metades `@OneToMany` ligadas por uma tabela de junção.
  Qualquer forma que aquela questão assumir restringe diretamente esta — a entidade de junção é
  "só" dois `@ManyToOne`, e cada lado do M:N é "só" um `@OneToMany` sobre a entidade de junção.
- **A maquinaria de emissão de schema teria de ganhar uma capacidade nova.** Hoje
  `Database.createTables()` e `Database.createRelations()` só emitem DDL para entidades que o
  usuário registrou. Um `@ManyToMany` exige emitir uma tabela *sintetizada* que não tem classe
  visível ao usuário. É um padrão novo e significativo na camada de schema (e uma questão
  significativa sobre o que o `MetadataStorage` deveria guardar).
- **Toca a política de nomes de [support-user-indexes](support-user-indexes.md).** As duas
  colunas FK de uma tabela de junção são candidatas clássicas a índice composto
  (`(user_id, tag_id)` na direção direta, `(tag_id, user_id)` na reversa). Qualquer convenção de
  nomes que `@Index` vier a ter precisará se aplicar a tabelas de junção sintetizadas também.

## Comportamento atual (para a questão não decair)

- **Nada na superfície de decorators menciona M:N.** Sem `@ManyToMany`, sem `JoinTable`, sem
  `JoinColumn`.
- **O modelo de metadados não tem conceito de tabela de junção.** `RelationMetadata.columns` é
  uma lista plana de colunas FK na linha *local*. Não há campo `joinTable`, campo
  `inverseColumns`, nem maquinaria de entidade sintetizada.
- **`MetadataStorage` é chaveado por `Constructor` fornecido pelo usuário.** Uma tabela de junção
  sintetizada não tem construtor — então ou a forma do storage generaliza para
  `Constructor | symbol`, ou tabelas de junção vivem numa estrutura irmã.
- **`Database.createTables()` itera `this.metadata`** — nunca veria uma tabela de junção que não
  fosse uma entidade registrada. Ou o loop muda, ou `createTables` ganha uma segunda passagem
  sobre entidades sintetizadas.
- **O workaround hoje é totalmente manual.** Usuários declaram uma classe `UserTag` com duas
  relações `@ToOne` e colunas FK-como-PK, e percorrem os dois lados via
  `Repository<UserTag>.findMany`. Funciona, mas expõe a entidade de junção no código da
  aplicação.

## Esboço do espaço de design

Seis eixos a decidir. Nenhum endossado aqui.

### Eixo 1 — Entidade de junção sintetizada vs. explícita

- **Totalmente sintetizada.** `@ManyToMany(() => Tag) tags: Tag[]` em `User` (e o inverso em
  `Tag`); o OOR gera uma tabela `user_tags` por trás dos panos. Sem classe de usuário para a
  junção. API mais limpa; maior divergência do invariante "tudo é entidade registrada" que o
  resto do `MetadataStorage` assume.
- **Entidade de junção explícita** (estilo TypeORM, `@JoinTable` obrigatório). O usuário declara
  `UserTag` ele mesmo com dois `@ManyToOne`; o `@ManyToMany` do OOR é açúcar que percorre a
  entidade de junção declarada pelo usuário. Superfície nova menor na camada de metadados;
  empurra a entidade de junção de volta para o código da aplicação.
- **Sintetizada por default com escotilha.** Sintetiza a menos que o usuário passe
  `{ through: () => UserTag }`. Mais flexível; maior API.

### Eixo 2 — Lado dono vs. lado inverso

- **Lado dono obrigatório** (TypeORM). Um lado carrega `@JoinTable()`; o outro carrega
  `@ManyToMany(..., inverseSide)`. O lado dono controla nome, colunas e índices da tabela de
  junção.
- **Simétrico, sem lado dono.** Ambos os lados declaram `@ManyToMany`; o OOR canoniza o nome da
  tabela de junção (ex.: ordem alfabética) e a ordem das colunas. Modelo mental mais limpo para
  usuários; mais difícil dar knobs de configuração por lado (nomes de coluna, flags de cascade)
  quando não há assimetria.
- **Declaração de lado único.** Só o lado dono declara o M:N; o lado inverso não tem decorator.
  Menor API; perde o back-pointer em nível de tipos na classe inversa.

### Eixo 3 — Nome da tabela de junção

- **Auto** — `<table_a>_<table_b>` com os lados ordenados alfabeticamente (ou por ordem de
  declaração no lado dono). Previsível; sem escolha do usuário.
- **Fornecido pelo usuário** — `@ManyToMany({ joinTable: "user_tags" })`. Controle total; risco
  de colisões se usuários escolherem nomes descuidadamente.
- **Auto com override.** Gera por default, permite override de `joinTable`. Casa com o que outros
  ORMs fazem.

### Eixo 4 — Estratégia de carregamento

Herda do Eixo 3 de [support-one-to-many](support-one-to-many.md). A mesma escolha
lazy-vs-eager-vs-opt-in se aplica, mas o caso eager exige um JOIN de *dois saltos*
(`user → user_tags → tags`) em vez de um salto só. Qualquer padrão que `@OneToMany` adotar,
`@ManyToMany` estende — então o caminho de código de eager loading provavelmente quer ser
expresso em termos de caminhadas de relação, não contagens de JOIN hard-coded.

### Eixo 5 — Semântica de escrita

- **Replace-on-assignment.** `user.tags = [tag1, tag2]` seguido de `repo.update(user)` faz
  `DELETE FROM user_tags WHERE user_id = ?` e reinsere. Simples de raciocinar; performance
  surpreendente para conjuntos grandes.
- **Métodos explícitos `addRelation` / `removeRelation`.** Sem mágica na atribuição; usuários
  chamam `repo.addRelation(user, 'tags', tag)` e `repo.removeRelation(...)`. Superfície de API
  menor no caminho de `update`; maior no `Repository`.
- **Ambos.** Mais flexível; maior API. O mais próximo do que o TypeORM entrega.

### Eixo 6 — Cascade

- **Sem cascade — erro ao deletar pai com linhas de junção não vazias** (`RESTRICT` do
  PostgreSQL). Mais seguro.
- **Cascata só nas linhas de junção ao deletar o pai** (`ON DELETE CASCADE` nas FKs da tabela de
  junção). Quase sempre o que usuários querem — deletar um `User` deveria remover suas linhas de
  `user_tags`, mas não seus `Tag`s. Provavelmente o default certo.
- **Configurável por lado.** Casa com ORMs maduros.

## Coisas a verificar antes de decidir

- **Prior art.** TypeORM exige `@JoinTable` no lado dono; MikroORM gera automaticamente por
  default mas permite `pivotTable`; Drizzle trata a tabela de junção como schema declarado pelo
  usuário de primeira classe, sem decorator M:N especial. O ponto de referência certo depende de
  como o OOR quer se posicionar estilisticamente.
- **Se `MetadataStorage` deveria guardar entidades sintetizadas.** Se sim, o contrato de iteração
  muda (`Iterable<[Constructor | SyntheticKey, EntityMetadata]>`). Se não, tabelas de junção
  vivem num mapa irmão e todo consumidor do `MetadataStorage` (schema-create, schema-drop,
  repository, query-builder) precisa saber percorrer os dois. Vale decidir antes de implementar
  — retrofit é doloroso.
- **Interação com [Single-Table Inheritance](../concepts/single-table-inheritance.md).** Se
  qualquer lado de um M:N é uma subclasse STI, a FK da tabela de junção deveria referenciar a
  tabela raiz (já que é a tabela física real). O predicado de discriminador então vive na
  leitura, no mesmo lugar em que [support-one-to-many](support-one-to-many.md) o adiciona.
- **Chave primária composta na tabela de junção.** O padrão clássico é
  `PRIMARY KEY (user_id, tag_id)` em vez de um `id` surrogate sintético. A maquinaria atual de PK
  do OOR já suporta PKs compostas — verificar que funciona para entidades sintetizadas também.
- **Índice na direção *inversa*.** Um `PRIMARY KEY (user_id, tag_id)` cobre queries
  `WHERE user_id = ?` (prefixo esquerdo), mas `WHERE tag_id = ?` (a carga do lado inverso)
  precisa de índice próprio. Se [support-user-indexes](support-user-indexes.md) não tiver
  aterrissado, a implementação de M:N precisa ou hard-codar o segundo índice ou esperar.

## O que mudaria no codebase

Superfície aproximada para junção sintetizada, `@JoinTable` no lado dono, lazy loading,
cascade-ao-deletar-pai:

- **Novo `src/decorators/relation/many-to-many.ts`** e **`src/decorators/relation/join-table.ts`**
  — dois decorators pareados, similares ao padrão do TypeORM. Lado dono:
  `@ManyToMany(() => Tag) @JoinTable() tags: Tag[]`. Lado inverso:
  `@ManyToMany(() => User, user => user.tags) users: User[]`.
- **`src/core/metadata/metadata.ts`** — estender `RelationType` com um membro `MANY_TO_MANY` (ou
  modelar M:N como um *par* de entradas `TO_MANY` sintetizadas apontando através de uma entidade
  gerada). Adicionar `joinTableName` e `inverseColumns` a `RelationMetadata`, ou introduzir um
  tipo `JoinTableMetadata` novo guardado separadamente em `EntityMetadata`.
- **`MetadataStorage`** — decidir se entidades sintetizadas vivem em `storage` chaveadas por um
  `Symbol` sentinela, ou num campo irmão `joinTables: Map<string, EntityMetadata>`. Atualizar o
  contrato de iteração conforme.
- **`src/core/database/database.ts`** — `createTables` percorre entidades reais e sintetizadas.
  `createRelations` emite constraints de FK para colunas da tabela de junção. `dropTables`
  derruba tabelas sintetizadas antes das tabelas pai (a ordenação topológica existente já deve
  dar conta, se as tabelas de junção registrarem suas dependências corretamente).
- **`src/core/repository/repository.ts`** — caminho de escrita: tratar replace-on-assignment (ou
  expor métodos add/remove explícitos, dependendo do Eixo 5). Caminho de leitura: carregar a
  coleção fazendo join através da tabela sintetizada.
- **`src/core/query-builder/`** — estender a lógica de caminhada de relação de
  [support-one-to-many](support-one-to-many.md) para dois saltos (`user → user_tags → tags`).
- **Testes** — declaração dono + inverso, round trip de schema-create (verificar que
  `\d user_tags` mostra a tabela sintetizada), substituição de conjunto, comportamento de
  cascade, M:N em que um lado é subclasse STI.
- **Docs** — novas páginas de componente; estender `examples/relations/` com um exemplo M:N;
  atualizar [overview.md](../overview.md).

## O que fecharia esta questão

Uma decisão em cada eixo acima mais uma implementação entregue. Esta questão fica aberta até a
escolha de design estar travada *e* o código estar na main. Quase certamente produz ADR próprio
(`0010-many-to-many` ou similar), e o ADR de [support-one-to-many](support-one-to-many.md) deve
aterrissar primeiro, já que esta se constrói sobre ele.

## Confiança

**Aberta** — sem decisão, sem código, e pelo menos uma dependência upstream
([support-one-to-many](support-one-to-many.md)) também ainda aberta. Registrada porque (a) M:N é
a terceira perna do banquinho de relações e o OOR se *chama* Order of Relations, (b) a questão da
entidade sintetizada é estruturalmente grande o bastante para que trazê-la à tona agora seja mais
barato que descobri-la no meio da implementação, e (c) tem interações transversais com pelo menos
três outras questões de design abertas (one-to-many, user indexes, STI em qualquer lado de um
M:N).

## Questões relacionadas

- [support-one-to-many](support-one-to-many.md) — precisa aterrissar primeiro; M:N é
  convencionalmente implementado como duas metades O:M através de uma entidade de junção
  sintetizada.
- [support-user-indexes](support-user-indexes.md) — o índice de direção inversa na tabela de
  junção é o caso de uso canônico de um índice composto declarado pelo usuário; a política de
  nomes escolhida lá deveria cobrir tabelas sintetizadas também.
