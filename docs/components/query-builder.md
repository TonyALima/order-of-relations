# QueryBuilder

Módulo: `src/query-builder/` · Exporta: os tipos `Condition`, `FieldConditionBuilder`,
`Conditions`, `FindOptions` pelo barrel público (a classe em si não vai ao barrel)

## Propósito

`QueryBuilder<T>` é a classe concreta que compõe um `SELECT` SQL contra a entidade `T`. É a
camada para a qual as leituras do [Repository](repository.md) delegam, a casa da máquina do
callback `where` e o único lugar do OOR que transforma input de usuário em runtime em um
statement SQL parametrizado pronto para o wire.

Para a *ideia* de laziness, ver [concepts/lazy-query-builder.md](../concepts/lazy-query-builder.md).
Para a *assinatura de chamada* de `where`, ver
[concepts/conditions-proxy.md](../concepts/conditions-proxy.md). Esta página documenta a
*classe*: estado, postura de mutabilidade, métodos terminais e escopo atual.

## Estado interno

Quatro campos mutáveis:

```ts
private conditions: Condition[] = [];
private orderByClause: { column: keyof T; direction: 'ASC' | 'DESC' } | undefined;
private limitValue: number | undefined;
private offsetValue: number | undefined;
```

Condições de where e o filtro de discriminador de herança reduzem a entradas no array
`conditions`. Ordenação e paginação têm campos próprios.

A classe é **mutável, não imutável-por-cópia** — ver § Mutabilidade.

## Ciclo de vida

`QueryBuilder<T>` é um objeto de vida curta e dono único:

1. O repositório o constrói: `new QueryBuilder<T>(EntityClass, db)`.
2. `applyOptions(options?: FindOptions<T>): this` instala o callback `where` do usuário e o
   escopo de herança.
3. Um método terminal (`getMany()` / `getOne()`) é chamado. O SQL é composto, parametrizado e
   awaited contra o driver `SQL` do Bun, e as linhas retornam.
4. O builder é descartado.

Não existe hoje cenário em que dois consumidores seguram o mesmo builder esperando estados
divergentes.

## API pública

| Método | Assinatura | Notas |
| --- | --- | --- |
| `where` | `(callback: (conditions: Conditions<T>) => (Condition \| undefined)[]) => this` | **Substitui** as condições (`this.conditions = results`). Lança `UndefinedWhereConditionError(index)` se o callback retornar qualquer item `undefined`/`null`. |
| `orderBy` | `(column: keyof T, direction?: 'ASC' \| 'DESC') => this` | Uma cláusula por vez; última chamada vence. Default `ASC`. |
| `limit` | `(value: number) => this` | Lança `InvalidLimitError` em valor negativo. |
| `offset` | `(value: number) => this` | Lança `InvalidOffsetError` em valor negativo. |
| `applyOptions` | `(options?: FindOptions<T>) => this` | Ponto de entrada usado pelo repositório; aplica `where` e `inheritance`. |

## `applyOptions()` — o que consome

`FindOptions<T>` carrega dois campos:

```ts
export interface FindOptions<T> {
  where?: (conditions: Conditions<T>) => (Condition | undefined)[];
  inheritance?: InheritanceSearchType;
}
```

### `where` — substitui, não acumula

Chamar `where()` (diretamente ou via `applyOptions`) **substitui** as condições anteriores
atacado. "Última chamada vence" — deliberado:

- `findMany(options?)` / `findOne(options?)` do repositório são os pontos de entrada dominantes;
  chamam `applyOptions` exatamente uma vez.
- Composição parcial não é um caso de uso hoje; introduzi-la implicitamente via acumulação
  poderia mascarar bugs (reset esquecido, AND surpresa com estado velho).

Ver [questions/apply-options-accumulation.md](../questions/apply-options-accumulation.md) — a
questão em aberto sobre inverter para aditivo.

### `inheritance` — leituras com escopo de discriminador

`InheritanceSearchType` é um enum fechado com três valores que controlam como as leituras se
distribuem por uma hierarquia [STI](../concepts/single-table-inheritance.md):

| Valor | O que `applyOptions` faz | SQL emitido |
| --- | --- | --- |
| `ALL` (default) | Nada — não há branch para `ALL`. | Nada adicionado; lê toda linha da tabela herdada. |
| `ONLY` | Chama `setConcreteClassDiscriminator()`. | Empilha `discriminator = <self>` em `conditions`. |
| `SUBCLASSES` | Chama `setSubClassesDiscriminator()`. | Empilha `discriminator IN (...)` com `T` e todo descendente na cadeia de protótipos. |

Os dois helpers **empilham** em `this.conditions` em vez de substituir. A ordem em
`applyOptions` é `where` primeiro (substitui), depois `inheritance` (empilha), então uma única
chamada `applyOptions` aplica o predicado de discriminador em AND com as condições do usuário.

> **Discriminador só quando necessário.** O filtro de discriminador só é adicionado quando
> `meta.discriminator` é truthy — e o `MetadataStorage.resolveInheritance` *apaga* o
> discriminador de entidades sozinhas na tabela. Então `userRepo.findMany({ inheritance: ONLY })`
> contra um `User` sem subclasses é no-op em nível de SQL. Assim que um irmão se registra e a
> resolução reroda, a mesma chamada passa a emitir o predicado. O efeito da opção depende de
> existirem irmãos, não só do que o caller passou.

> **Footgun: applyOptions em dobro.** Se `applyOptions` for chamado duas vezes — uma com
> `inheritance`, outra com `where` — o `where` da segunda **atropela** o discriminador (porque
> `where` *substitui* e o `inheritance` ficou só na primeira chamada). Passe sempre os dois
> campos juntos, numa chamada só.

A descoberta de subclasses é uma caminhada pura pela cadeia de protótipos contra o `Map` de
metadados vivo — sem strings de nome, sem registro manual.

## Métodos terminais

Dois, hoje:

| Método | Retorna | Notas |
| --- | --- | --- |
| `getMany()` | `Promise<T[]>` | Todas as linhas que casam. Resultado vazio é `[]`, nunca `null`. |
| `getOne()` | `Promise<T \| null>` | Primeira linha de um `SELECT ... LIMIT 1`, ou `null`. Emite `LIMIT 1` no SQL (via `executeSelect(true)`), que tem precedência sobre qualquer `limit()` anterior. |

Ausentes e reconhecidos como trabalho futuro: `getCount()`, `getExists()`, streaming. O formato
`getX(): Promise<X>` é o padrão; novos terminais entram sem perturbar a API de cláusulas.

## Mutabilidade

> **Mutável, não imutável-por-cópia — por design.** O builder é um objeto de vida curta e dono
> único. Não há cenário em que dois consumidores seguram o mesmo builder esperando estados
> divergentes, então a segurança que imutabilidade-por-cópia compraria é irrelevante — e as
> alocações por cláusula seriam pagas por nada. Se um caso de compartilhamento aparecer (ex.:
> cachear uma query parcial), o plano é introduzir um `clone()` em vez de retrofitar
> copy-on-write em todo método.

O que faz a laziness funcionar é a **execução adiada**, não imutabilidade.

## Composição de SQL

Os dois terminais passam por um único template privado, `executeSelect(addLimit: boolean)`. O
corpo compõe fragmentos opcionais — `cols`, `whereClause`, `orderByClause`, `limitClause`,
`offsetClause` — em um `SELECT ${cols} FROM ${tableName} ${where} ${orderBy} ${limit} ${offset}`.

> **Um template, extensibilidade em forma de fragmento.** Cláusulas futuras entram como mais um
> fragmento opcional cada, não como um fork combinatório. E `SELECT *` não existe em lugar
> nenhum — usa-se sempre `SELECT ${cols}` para que colunas do banco não declaradas nos metadados
> da entidade não vazem nas leituras.

A composição usa quatro mecanismos de segurança (ver
[concepts/parameterized-sql.md](../concepts/parameterized-sql.md) para a propriedade de base):

- **Operadores vêm de um mapa fechado.** `opFragments` mapeia cada `Condition['op']` para um
  fragmento pré-construído. O token do operador *nunca* é montado a partir de input de usuário.
- **Nomes de coluna passam por `sql(c.columnName)`** — a forma de identificador do Bun. Seguro
  mesmo quando o `columnName` dos metadados derivou de código do usuário (argumento de
  decorator).
- **Valores passam por binding de parâmetro normal.** `${value}` no tagged template vira
  placeholder.
- **O juntor de fragmentos é `sqlJoin`** — nunca um `reduce` feito à mão.

O operador `IN` merece nota: `` sql`${col} IN ${sql(c.value)}` `` — `sql(array)` faz bind de cada
elemento como parâmetro. Um **array vazio** produz um `IN ()` válido que não casa nada, em vez de
quebrar. A suíte de testes fixa isso.

## Escopo

O que `QueryBuilder<T>` **não** faz hoje, por escopo deliberado:

- **Sem OR / árvores booleanas aninhadas.** `where` é uma lista AND plana. Uma DSL booleana de
  verdade é superfície de API significativa; adiada até aparecer um caso de uso concreto (ver
  [questions/support-and-or-conditions.md](../questions/support-and-or-conditions.md)).
- **Sem joins.** Relações são carregadas por helpers do repositório, não por joins no builder.
- **Sem escotilha crua (`qb.raw(...)`)**. Reafirma
  [ADR 0004](../decisions/0004-parameterized-sql-only.md) — a superfície tipada é estendida; o
  invariante parametrizado não é enfraquecido.

Nota de exposição: `orderBy`/`limit`/`offset` existem no builder, mas `FindOptions<T>` carrega
apenas `where` e `inheritance` — ou seja, pelo `Repository` só `where` e `inheritance` estão
disponíveis; as cláusulas fluentes exigem construção direta do builder (escotilha interna).

## Fluxo de tipos

`QueryBuilder<T>` carrega `T` de ponta a ponta: o construtor recebe `new () => T`;
`applyOptions`/`where`/`orderBy`/`limit`/`offset` retornam `this` preservando `T`;
`getMany(): Promise<T[]>` / `getOne(): Promise<T | null>` entregam resultados tipados como `T`.

O mapped type que faz o trabalho pesado:

```ts
export type Conditions<T> = {
  [K in keyof T]?: FieldConditionBuilder<Unbrand<T[K]>>;
};
```

O `?` é estrutural — ver [concepts/conditions-proxy.md](../concepts/conditions-proxy.md) para a
justificativa.

## Conexões

- [concepts/lazy-query-builder.md](../concepts/lazy-query-builder.md) — o conceito que esta
  classe realiza.
- [concepts/conditions-proxy.md](../concepts/conditions-proxy.md) — o objeto tipado passado a
  `where`.
- [concepts/parameterized-sql.md](../concepts/parameterized-sql.md) — a propriedade de segurança
  que o builder deve preservar.
- [questions/get-one-limit-1.md](../questions/get-one-limit-1.md) — questão resolvida: `getOne()`
  emite `LIMIT 1`.
