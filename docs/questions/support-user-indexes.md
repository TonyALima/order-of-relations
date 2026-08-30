# O OOR deveria suportar índices definidos pelo usuário (`@Index` / `@Unique`)?

> Status: **aberta** (sem implementação; nenhum decorator existe hoje) · Impacto: **médio** ·
> Esforço: **M**

## Questão

O OOR atualmente não tem como um usuário declarar um índice. O único índice jamais emitido é o
`idx_discriminator` implícito que o schema-create adiciona para raízes de
[Single-Table Inheritance](../concepts/single-table-inheritance.md). Deveríamos adicionar um
decorator `@Index` (e provavelmente `@Unique`) para que consumidores marquem colunas e tuplas de
colunas quentes em queries para indexação, com o schema-create emitindo `CREATE INDEX` junto do
`CREATE TABLE`?

## Por que importa

- **Piso real de um ORM.** Qualquer aplicação não trivial rodando contra PostgreSQL bate num
  muro no momento em que um `WHERE` filtra numa coluna não indexada sobre uma tabela grande. Sem
  `@Index`, as únicas escotilhas são (a) SQL de migration escrito à mão fora do OOR, ou (b)
  aceitar o custo de full-scan. Ambas minam o valor de usar o OOR de ponta a ponta.
- **O codebase já prova que o padrão de emissão de schema funciona.** O schema-create já emite
  `ALTER ADD COLUMN discriminator` + `CREATE INDEX idx_discriminator` para raízes STI (ver
  [architecture.md — schema create/drop](../architecture.md#schema-createdrop)). Índices
  definidos pelo usuário reutilizariam a mesma passagem de emissão — o wiring existe; só falta a
  fonte de metadados.
- **Alimenta a questão de ordem de decorators.**
  [decorator-order-independence](decorator-order-independence.md) já sinaliza `@Index` e
  `@Unique` como futuros irmãos esperados de `@Column` / `@Nullable`. A resolução escolhida lá
  (Opção A — adiar joins para `@Entity`) foi selecionada em parte porque escala para N
  decorators coordenando. Registrar esta questão torna esse "N" concreto.
- **Compõe com o risco de colisão de `idx_discriminator`.** Uma vez que índices de usuário
  existam, colisão de nomes vira uma preocupação geral, não só-de-STI — ambos deveriam
  provavelmente compartilhar uma política de nomes (ver
  [idx-discriminator-collision](idx-discriminator-collision.md)).

## Comportamento atual (para a questão não decair)

- **Não existe decorator `@Index` / `@Unique`.** `src/decorators/` contém apenas `column/`,
  `entity/`, `nullable/`, `relation/`.
- **Nenhum metadado de índice é guardado.** O
  [MetadataStorage](../components/metadata-storage.md) guarda `EntityMetadata` chaveado por
  classe; a lista de colunas da entrada (`columns: ColumnMetadata[]`) não tem campos `index` /
  `unique`. A unicidade de chave primária é enforced via `PRIMARY KEY` na DDL, não via um
  `@Unique` dedicado.
- **O único índice que o OOR emite é o índice de discriminador.** Hard-coded no caminho de
  schema-create; sem input do usuário.
- **Workarounds hoje** são out-of-band: escrever uma migration `.sql` depois que o schema-create
  roda, ou estender o banco manualmente.

## Esboço do espaço de design

Três eixos a decidir. Nenhum endossado aqui.

### Eixo 1 — Onde o decorator vai

- **Só em propriedade** (`@Index column: string;`) — o mais simples. Força índices compostos para
  a classe.
- **Só em classe** (`@Entity({ indexes: [{ columns: ["lastName", "firstName"] }] })`) — uniforme;
  toda a informação de índice num lugar só. Menos ergonômico para o caso comum de coluna única.
- **Ambos** (`@Index` em propriedades para coluna única, opções em nível de classe para
  composto) — mais ergonômico; maior superfície de API. O TypeORM tomou esse caminho.

### Eixo 2 — `@Unique` como decorator separado vs. `@Index({ unique: true })`

- **`@Unique` separado** — mais claro no call site; espelha o padrão `@Nullable` /
  `@NotNullable` que o OOR já usa. Duas pastas de decorator para manter.
- **Flag em `@Index`** — menos decorators; a flag `unique: true` lê um pouco menos claramente que
  um decorator dedicado. Uma pasta.

### Eixo 3 — Política de nomes

- **Auto-gerado** (`idx_<table>_<col1>_<col2>`) — previsível, sem escolha do usuário. Compõe
  naturalmente com uma correção da colisão de `idx_discriminator` (renomear para
  `idx_<root>_discriminator`).
- **Fornecido pelo usuário** (`@Index({ name: "..." })`) — controle total; risco de colisões se
  usuários escolherem nomes descuidadamente.
- **Auto com override** — gera por default, permite override de `name`. Mais flexível; casa com o
  padrão que outros ORMs usam.

## Coisas a verificar antes de decidir

- **Prior art.** TypeORM tem `@Index` (propriedade + classe), `@Unique` (só em nível de classe).
  Drizzle tem `index()` / `uniqueIndex()` em nível de tabela. MikroORM tem `@Index` / `@Unique`
  nos dois níveis. Vale uma página de comparação antes de comprometer uma forma.
- **Índices parciais / funcionais / GIN e amigos.** `CREATE INDEX ... WHERE deleted_at IS NULL` e
  `CREATE INDEX ... USING GIN (col)` são features reais do PostgreSQL que consumidores do OOR vão
  querer eventualmente. A primeira se enreda com
  [parameterized SQL](../concepts/parameterized-sql.md) (o corpo do `WHERE` é uma string SQL
  literal, não uma expressão parametrizada). Decidir se a v1 suporta algum desses ou se limita a
  B-tree puro.
- **Semântica de drop.** O schema-drop faz `DROP TABLE` topologicamente revertido. `DROP TABLE`
  cascateia índices automaticamente, então o schema-drop pode não precisar de mudança — mas
  verificar, e decidir se vale emitir `DROP INDEX` explícito por clareza.
- **Interação com a resolução de [decorator-order-independence](decorator-order-independence.md).**
  Se aquela questão fechar com a Opção A (adiar joins para `@Entity`), `@Index` deveria seguir o
  mesmo padrão desde o primeiro dia — empilhar entradas `IndexMetadata` cruas num
  `INDEXES_KEY`, deixar `@Entity` fazer o join. Não entregar `@Index` com o padrão antigo de
  "ler irmão em tempo de decoração" para refatorar depois.
- **A correção da colisão de `idx_discriminator` deveria aterrissar junto.** Hoje
  `idx_discriminator` é o mesmo nome em todas as raízes STI. Uma vez que índices de usuário
  existam, todo nome é propenso a colisão. Uma política de nomes (`idx_<table>_<cols>`) deveria
  se aplicar uniformemente a índices de discriminador e de usuário.

## O que mudaria no codebase

Superfície aproximada para `@Index` em nível de propriedade + composto em nível de classe + nomes
auto-gerados:

- **Novo `src/decorators/index/index.ts`** — declara `INDEXES_KEY = Symbol('indexes')`. `@Index`
  (e provavelmente `@Unique` numa pasta irmã) escreve entradas `IndexMetadata`:
  `{ columns: string[], unique: boolean, name?: string }`.
- **`src/decorators/entity/entity.ts`** — ler `INDEXES_KEY`, copiar para
  `EntityMetadata.indexes: IndexMetadata[]`. Se a Opção A de
  [decorator-order-independence](decorator-order-independence.md) for escolhida, é a mesma
  passagem de join.
- **`src/core/sql-types/`** (ou onde a geração de DDL morar) — estender a passagem de emissão do
  schema-create: após `CREATE TABLE`, emitir um `CREATE [UNIQUE] INDEX <name> ON <table> (<cols>)`
  por entrada `IndexMetadata`. Gerar `<name>` como `idx_<table>_<col1>_<col2>` (ou
  `uniq_<table>_<...>`) quando não fornecido pelo usuário.
- **Índice de discriminador STI** — refatorar de `idx_discriminator` hard-coded para usar o mesmo
  gerador: `idx_<root>_discriminator`. Fecha a questão de colisão latente de uma vez.
- **[MetadataStorage](../components/metadata-storage.md)** — estender `EntityMetadata` com
  `indexes: IndexMetadata[]`.
- **Testes** — índice de coluna única, composto, unique-vs-não-unique, override de nome, teste de
  integração afirmando que `\d <table>` mostra os índices após o schema-create.
- **Docs** — nova página de componente, atualizar
  [architecture.md](../architecture.md#schema-createdrop) para mencionar índices de usuário ao
  lado do índice de discriminador, atualizar [overview.md](../overview.md).

## O que fecharia esta questão

Uma decisão em cada eixo acima mais uma implementação entregue. Saídas prováveis: um ADR novo e
um ou dois componentes de decorator novos.

## Confiança

**Aberta** — sem decisão, sem código. Registrada porque a lacuna é real, a maquinaria de emissão
de schema já está no lugar, e a escolha de design interage com pelo menos duas outras questões
abertas ([decorator-order-independence](decorator-order-independence.md), a colisão de
`idx_discriminator`).

## Questões relacionadas

- [decorator-order-independence](decorator-order-independence.md) — a resolução escolhida deveria
  restringir como `@Index` lê metadados de irmãos.
- [idx-discriminator-collision](idx-discriminator-collision.md) — deveria se fundir na política de
  nomes que esta questão definir.
