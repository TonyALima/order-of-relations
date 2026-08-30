# Hierarchical Data Models

O conjunto de técnicas de modelagem SQL usadas para armazenar dados em forma de árvore —
categorias, threads de comentários, sistemas de arquivos, organogramas — num schema relacional
plano. Existem quatro abordagens canônicas; cada uma troca eficiência de leitura por complexidade
de escrita de forma diferente.

Contexto trazido pelo [paper JCSI 2025](../research/orm-frameworks-node-jcsi-2025.md), que usa a
variante Adjacency List no seu benchmark de árvore de comentários e nota que o TypeORM é o único
ORM Node do trio que entrega decorators para as outras três.

## Adjacency List

A abordagem mais simples: cada linha tem uma coluna `parent_id` apontando para o pai (ou null na
raiz).

```sql
CREATE TABLE comment (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES comment(id),
  body TEXT
);
```

- **Escritas:** triviais. Insert com um `parent_id`.
- **Leituras (um nível):** triviais. `WHERE parent_id = ?`.
- **Leituras (subárvore inteira):** CTE recursiva ou N round trips. **Este é o custo que o paper
  JCSI mede** — o endpoint de árvores é onde o Adjacency List bate no teto.
- **Suporte de ORM:** universal. Todo ORM consegue expressar; é só um `@Column` em `parent_id`.

## Closure Table

Uma tabela `closure` separada armazena **toda relação ancestral-descendente** da árvore —
`(ancestor_id, descendant_id, depth)`:

```sql
CREATE TABLE comment_closure (
  ancestor_id INTEGER NOT NULL REFERENCES comment(id),
  descendant_id INTEGER NOT NULL REFERENCES comment(id),
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);
```

- **Escritas:** O(profundidade) linhas extras por insert; caro, mas previsível.
- **Leituras:** O(1) para "todos os descendentes de N" — uma única consulta de índice.
- **Suporte de ORM:** TypeORM entrega `@Tree('closure-table')`. Prisma / Sequelize exigem schema
  e triggers manuais.

## Nested Set

Cada linha armazena um par `(lft, rgt)` representando um intervalo de varredura em pré-ordem. Os
descendentes de um nó são todas as linhas com `lft > parent.lft AND rgt < parent.rgt`.

- **Escritas:** todo insert/delete reembaralha `lft`/`rgt` em muitas linhas — updates em massa
  por operação.
- **Leituras:** O(1) para qualquer query de subárvore.
- **Suporte de ORM:** TypeORM entrega `@Tree('nested-set')`. Prisma / Sequelize exigem manual.

## Materialized Path

Cada linha armazena uma string com o caminho dos IDs ancestrais, ex. `/1/4/9/`. Queries de
subárvore usam `LIKE '/1/4/%'`.

- **Escritas:** O(1) para inserts; mover subárvores exige atualizar o caminho de cada
  descendente.
- **Leituras:** O(1) para subárvore (com o índice certo na coluna de caminho).
- **Suporte de ORM:** TypeORM entrega `@Tree('materialized-path')`. Prisma / Sequelize exigem
  manual.

## Comparação

| Estratégia | Custo de escrita | Custo de leitura (subárvore) | Suporte de ORM |
| --- | --- | --- | --- |
| Adjacency List | O(1) | O(profundidade) — recursiva | universal |
| Closure Table | O(profundidade) | O(1) | TypeORM tem decorator; demais manual |
| Nested Set | O(N) em muitas ops | O(1) | TypeORM tem decorator; demais manual |
| Materialized Path | O(1) insert; O(N) em moves | O(1) | TypeORM tem decorator; demais manual |

## Relevância para o OOR

O OOR **não tem suporte a árvores hoje** — nem Adjacency List como decorator, nem as outras três.
Um usuário que quisesse árvores teria de montar por conta própria com `@Column` para `parent_id`
e escrever as queries recursivas à mão.

> **Espaço de design em aberto.** Se o OOR deveria entregar decorators de árvore é uma questão
> não resolvida. O primeiro passo mais simples seria um par `@TreeParent` / `@TreeChildren` para
> Adjacency List, espelhando o que Sequelize e Prisma oferecem organicamente. O passo mais rico —
> espelhar Closure / Nested Set / Materialized Path do TypeORM — é significativamente mais código
> e lock-in num formato de árvore só.

## Adjacente em forma: Single-Table Inheritance

A [Single-Table Inheritance](single-table-inheritance.md) do OOR é o *outro* conceito de "encaixar
uma estrutura não-plana numa tabela plana". Os dois dividem audiência (usuários com dados
meio-hierárquicos), mas resolvem problemas diferentes:

- **STI:** hierarquia de tipos → uma tabela, uma coluna discriminadora.
- **Hierarchical Data Models:** hierarquia de instâncias → várias tabelas e colunas.

Ambos acabam codificando estrutura em árvore em tabelas planas; nenhum substitui o outro.

## Conexões

- [research/orm-frameworks-node-jcsi-2025.md](../research/orm-frameworks-node-jcsi-2025.md) — o
  contexto empírico (endpoint de árvores do benchmark).
- [single-table-inheritance.md](single-table-inheritance.md) — o conceito adjacente de "achatar
  uma hierarquia" que o OOR já implementa.
