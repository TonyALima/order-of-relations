# Parameterized SQL

## Definição

**SQL parametrizado** separa a *forma* da query (uma string com placeholders) dos seus *valores*
(passados junto como um array discreto). O driver do banco — não concatenação de strings — é
responsável por fazer o bind dos valores no plano da query, o que torna SQL injection impossível
por construção para as partes parametrizadas.

No driver `SQL` do Bun, isso é a forma de tagged template
`` sql`SELECT * FROM users WHERE id = ${id}` ``. A interpolação produz um placeholder + um
parâmetro bound, nunca uma substring do texto SQL.

## Como funciona

Quando o driver recebe `` sql`SELECT * FROM users WHERE id = ${id}` ``, ele:

1. Monta o texto SQL `SELECT * FROM users WHERE id = $1`.
2. Monta um array de parâmetros `[id]`.
3. Envia ambos ao PostgreSQL via wire protocol.
4. O PostgreSQL planeja a query com `$1` como placeholder e faz bind do valor em tempo de
   execução.

O valor fornecido pelo usuário **nunca** faz parte do texto SQL que o planner vê. Mesmo um valor
contendo `'; DROP TABLE users;--` é tratado como um literal único, não como sintaxe SQL.

A escotilha — `sql.unsafe(text)` do Bun — bypassa tudo isso emitindo `text` diretamente na string
SQL. O OOR proíbe `sql.unsafe` em toda a biblioteca (ver
[ADR 0004](../decisions/0004-parameterized-sql-only.md)).

## Por que importa

- **Livre de injeção por construção.** Sem interpolação = sem injeção. É a única defesa completa;
  todo o resto (escaping, allowlists, filtros de regex) tem bypasses conhecidos.
- **Cache de planos.** Queries parametrizadas com a mesma forma podem compartilhar um plano
  cacheado no PostgreSQL — ganho mensurável em escala.
- **Clareza de auditoria.** Um revisor lendo um diff confirma "sem `sql.unsafe`" mecanicamente;
  "essa interpolação de string é segura?" exige raciocínio por chamada.

## Exemplos

Seguro, a única forma permitida no OOR:

```ts
const id = req.body.id; // input do usuário
const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
```

Proibido no OOR:

```ts
// Banido: sql.unsafe não é usado em lugar nenhum do codebase.
const rows = await sql.unsafe(`SELECT * FROM users WHERE id = ${id}`);
```

Restrição: identificadores (nomes de tabela e coluna) não podem ser parametrizados em SQL padrão
— eles não são valores. Quando uma query precisa de um identificador dinâmico, ele deve vir de
uma allowlist ou de um helper de quoting, nunca de input cru do usuário. No Bun, a forma
`sql(nome)` é o helper de identificador usado pelo OOR para nomes de coluna e tabela vindos de
metadados.

## `sqlJoin` — o juntor sancionado de fragmentos

`sqlJoin` (em `src/core/utils/`) é a **única forma sancionada** no codebase de combinar um array
de fragmentos SQL em um fragmento único com separador. É usado por todo site que compõe SQL a
partir de pedaços — `Repository.create`, `Repository.update`, `Repository.delete` e o `WHERE` do
`QueryBuilder`.

```ts
sqlJoin({ sql, items, map, separator });
```

`items` é o array, `map` produz um fragmento por elemento, e `separator` tem default `, `
(frequentemente sobreposto por `AND` para cláusulas `WHERE`). O helper retorna um único fragmento
de tagged template que preserva todos os bindings de parâmetros — a parametrização sobrevive ao
join.

O padrão que ele substitui — um `reduce` feito à mão sobre um array de fragmentos — é um footgun
documentado: fácil pular um separador, fácil derrubar o elemento head (off-by-one no acumulador),
fácil bagunçar a ordem dos parâmetros concatenando strings cruas em vez de fragmentos. `sqlJoin`
existe para que "fazer um reduce na mão" nunca precise ser uma decisão de code review. Ele também
reforça a ADR 0004 por outro ângulo: a ADR proíbe `sql.unsafe`; o `sqlJoin` remove a *tentação*
de alcançar operações inseguras em nível de string quando um join é necessário.

Uso canônico, dentro do `WHERE` do `QueryBuilder`:

```ts
sqlJoin({
  sql,
  items: this.conditions,
  map: (c) => sql`${sql(c.columnName)} ${opFragments[c.op]} ${c.value}`,
  separator: sql` AND `,
});
```

No `Repository.create()`, juntar a lista de colunas e a de valores são duas chamadas `sqlJoin` —
uma para `(col1, col2, col3)`, outra para `($1, $2, $3)`.

## Conexões

- [ADR 0004](../decisions/0004-parameterized-sql-only.md) — a decisão que fixa a regra.
- [lazy-query-builder.md](lazy-query-builder.md) — o builder que precisa produzir SQL
  parametrizado em tempo de compilação do statement.
- [components/sql-types.md](../components/sql-types.md) — a mesma propriedade de segurança
  aplicada a identificadores de DDL (enum fechado em vez de parâmetros bound).
