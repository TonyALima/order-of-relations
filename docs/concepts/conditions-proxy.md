# Conditions Proxy

## Definição

O **conditions proxy** é o objeto tipado passado ao callback `where` de um `QueryBuilder<T>`. Ele
expõe um `FieldConditionBuilder` por coluna de `T`, cada um carregando os operadores válidos para
o tipo daquela coluna. O callback do usuário consome o proxy e retorna um array de entradas
`Condition` (ou `undefined`).

A assinatura exata do callback:

```ts
where: (conditions: Conditions<T>) => (Condition | undefined)[]
```

E o tipo do proxy:

```ts
export type Conditions<T> = {
  [K in keyof T]?: FieldConditionBuilder<Unbrand<T[K]>>;
};
```

Um mapped type `Partial` sobre as chaves da entidade. Cada chave mapeia para um builder por campo
parametrizado pelo tipo *sem brand* do campo — `u.age.gt(18)` aceita `number`,
`u.name.eq('Alice')` aceita `string`, `u.id?.eq(1)` aceita um `number` puro mesmo que `T['id']`
seja `PrimaryKey<number>`, e um typo no nome da propriedade é erro de compilação. O brand é
apagado em runtime, então a comparação SQL não se importa; no nível de tipos, os callers escrevem
predicados sem cerimônia. Ver [primary-key-brand.md](primary-key-brand.md) para `Unbrand<V>`.

```ts
userRepo.findMany({
  where: (u) => [u.email!.eq('a@b.com')],
});
```

Aqui `u` é o conditions proxy de `User`; `u.email` é um `FieldConditionBuilder<string>`;
`.eq(...)` produz uma `Condition`.

## Como funciona

O query builder constrói o proxy a partir dos metadados de coluna da entidade:

- Para cada `ColumnMetadata`, anexa um `FieldConditionBuilder` chaveado pelo nome da propriedade
  da coluna.
- Cada `FieldConditionBuilder<V>` expõe **os mesmos nove métodos, qualquer que seja `V`**:
  - **Comparação:** `eq(v)`, `ne(v)`, `gt(v)`, `gte(v)`, `lt(v)`, `lte(v)` — produzem `=`, `!=`,
    `>`, `>=`, `<`, `<=` respectivamente.
  - **Testes de null:** `isNull()`, `isNotNull()` — produzem `IS NULL` / `IS NOT NULL`.
  - **Pertencimento a conjunto:** `in(values: V[])` — produz `IN (...)`. Um array vazio é um
    `IN ()` válido que não casa nada; a suíte de testes fixa isso.
- O *tipo* do proxy deriva da própria classe da entidade: os mapped types do TypeScript pegam as
  colunas de `T` e produzem `{ [K in keyof T]?: FieldConditionBuilder<Unbrand<T[K]>> }`.

O callback `where` do usuário roda, retorna um array, e o conteúdo do array é validado antes da
composição do SQL — ver [components/query-builder.md](../components/query-builder.md).

## Por que importa

- **Referências de coluna type-safe.** Errar o nome de uma coluna não passa no typecheck; o proxy
  não expõe propriedades que não são colunas.
- **Valores type-safe, superfície de operadores uniforme.** A garantia de compilação está no
  **parâmetro de valor** — `gt(v: V)` rejeita um valor cujo tipo não casa com `V`. **Não** há
  narrowing por tipo de coluna na disponibilidade de operadores: uma coluna `Date` e uma coluna
  `number` expõem os mesmos nove métodos. (Uma API futura poderia estreitar mais — ex.: expor um
  `like` específico de string ou um `between` específico de data só nos tipos certos — mas hoje a
  superfície é uniforme.)
- **Sem concatenação de strings.** Operadores são pré-tokenizados em fragmentos SQL; valores
  ficam como parâmetros. O proxy é a camada de usuário que torna
  [parameterized SQL](parameterized-sql.md) enforceável nas leituras compostas.
- **Sem `any`.** Toda a construção se apoia em tipos condicionais / mapped — exatamente o padrão
  que a [ADR 0005](../decisions/0005-no-any-type-driven-api.md) assume.

## Armadilhas

### Por que o mapped type é `Partial`

O `?` em `Conditions<T>` é **estrutural**, não estilístico.

Ele existe para que chamadas `u.name?.eq(...)` passem no typecheck contra entidades em que
algumas propriedades vivem numa classe base, são herdadas via single-table inheritance ou são
simplesmente opcionais no tipo mas podem não existir nos metadados. O TypeScript fica quieto; a
camada de runtime (o proxy + o `UndefinedWhereConditionError`) cobre a lacuna entre *"o
TypeScript acha que isso pode ser undefined"* e *"na verdade, a coluna não existe"*.

Este é o inverso do padrão da constraint de ordem de decorators: lá, o runtime pega o que o
compilador não conseguiu rejeitar; aqui, o runtime pega o que o compilador **deliberadamente**
permitiu.

### O que dá errado em runtime

Se o usuário escrever `u.foo?.eq(...)` contra uma coluna que não existe (typo, lag de refactor),
`u.foo` é `undefined`, o `.eq` com optional-chaining retorna `undefined`, e a condição entra no
array como `undefined`. **O query builder pega isso** e lança `UndefinedWhereConditionError`,
carregando o **índice ofensor** (para o usuário localizar imediatamente a entrada ruim no array
`where`), em vez de descartar o predicado em silêncio.

### A non-null assertion (`u.email!`)

A non-null assertion é necessária quando a coluna é tipada como nullable na entidade
(`email?: string`) mas o autor da query sabe que o predicado deve valer mesmo assim. O proxy
preserva a nullability dos metadados da coluna, então a assertion é um narrowing deliberado que o
usuário assume.

## Exemplos

```ts
// Igualdade
userRepo.findMany({ where: (u) => [u.email!.eq('a@b.com')] });

// Múltiplas condições (AND)
userRepo.findMany({
  where: (u) => [u.active!.eq(true), u.createdAt!.gt(new Date('2026-01-01'))],
});
```

## Conexões

- [lazy-query-builder.md](lazy-query-builder.md) — dono do proxy e consumidor do
  `(Condition | undefined)[]` retornado.
- [components/query-builder.md](../components/query-builder.md) — a classe concreta que constrói
  e valida o proxy em runtime.
- [primary-key-brand.md](primary-key-brand.md) — fornece o helper mapped `Unbrand<V>` que deixa
  `c.id?.eq(1)` aceitar um literal puro.
- [questions/support-and-or-conditions.md](../questions/support-and-or-conditions.md) — a
  estrutura array-como-AND inviabiliza OR; o espaço de design para combinadores AND / OR / NOT.
