# PrimaryKey Brand

## Definição

`PrimaryKey<V>` é um **brand estrutural** que marca um campo de chave primária no nível de tipos.
É puramente um construto de tipos — em runtime, um `PrimaryKey<number>` é só um `number`.

```ts
declare const __pkBrand: unique symbol;

/** Marca um campo de chave primária. Brand puramente de tipos — apagado em runtime. */
export type PrimaryKey<V> = V & { readonly [__pkBrand]: true };

/** Remove o brand `PrimaryKey<>`; deixa outros tipos passarem. */
export type Unbrand<V> = V extends PrimaryKey<infer U> ? U : V;
```

`PrimaryKey<V>` vive no módulo do decorator de coluna e é exportado pelo barrel público do pacote
— usuários precisam dele para declarar entidades. `Unbrand<V>` é maquinaria interna companheira.

## Como funciona

### O brand é uma interseção

`PrimaryKey<V>` é `V & { readonly [__pkBrand]: true }`. Qualquer tipo com uma propriedade
`[__pkBrand]: true` na interseção estende `PrimaryKey<unknown>`, não importa como foi construído.
O `unique symbol` tem escopo de módulo — importar `PrimaryKey<V>` **não** expõe o símbolo aos
consumidores.

### Assimetria do brand — o truque ergonômico estrutural

Como `PrimaryKey<V>` é um **subtipo** de `V`:

| Direção | Compila? | Razão |
| --- | --- | --- |
| `PrimaryKey<number>` → `number` | ✓ | A interseção estreita para o operando esquerdo. |
| `number` → `PrimaryKey<number>` | ✗ | Um `number` puro não tem o brand. |

O OOR explora essa assimetria para manter os call sites livres de brand:

- **Saídas** mantêm `T` com brand. O brand é informação; preservá-lo permite ao caller passar
  entidades retornadas de volta para outros métodos sem cerimônia.
- **Entradas** aceitam valores *sem brand* via o mapped type `Unbrand<V>`. Callers escrevem
  `repo.findById({ id: 1 })` com um literal puro.

O round-trip `repo.update(await repo.findById({ id: 1 }))` funciona sem cast algum. O brand é
invisível para consumidores nos fluxos normais; só aparece no site de **declaração**, que é
exatamente onde sua visibilidade cumpre seu propósito.

> **Por que um brand, e não um generic em `Repository<T, PK>`.** Um generic
> `Repository<T, PK extends keyof T>` forçaria o usuário a escrever
> `new Repository<User, 'id'>(User, db)` — verboso na construção, e o TypeScript não pega
> divergência entre o generic `PK` e os metadados de runtime de `@PrimaryColumn`.
> `Repository<User, 'name'>` passaria no typecheck em silêncio e discordaria do decorator em
> runtime. **Um brand no site de declaração fecha essa lacuna** — o tipo do campo e a constraint
> do decorator são verificados um contra o outro na mesma chamada. Ver
> [ADR 0008](../decisions/0008-pk-aware-compile-time.md) para a análise completa das
> alternativas.

## Tipos auxiliares

Internos — não exportados pelo barrel público. Vivem ao lado de `Repository` e consomem o brand
estruturalmente.

```ts
type PKKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends PrimaryKey<unknown> ? K : never;
}[keyof T];

type UnbrandedT<T> = { [K in keyof T]: Unbrand<T[K]> };
export type PKInput<T> = { [K in PKKeys<T>]-?: NonNullable<Unbrand<T[K]>> };
export type PKOutput<T> = { [K in PKKeys<T>]-?: NonNullable<T[K]> };
```

| Tipo | Forma | Usado como |
| --- | --- | --- |
| `PKKeys<T>` | união dos nomes de propriedade cujo valor estende `PrimaryKey<unknown>` | o extrator estrutural; `NonNullable<>` deixa o `id?: PrimaryKey<number>` de autogeração casar |
| `UnbrandedT<T>` | `T` com todo campo sem brand | input de `create()`, forma da entidade em `update()` |
| `PKInput<T>` | toda chave PK, todas obrigatórias, todas não-`undefined`, **sem brand** | `findById(key)`, `delete(key)` |
| `PKOutput<T>` | toda chave PK, todas obrigatórias, todas não-`undefined`, **com brand** | forma de retorno de `create()` |

## Como os decorators enforcem o brand

`@PrimaryColumn` carrega o brand para dentro da constraint do tipo do campo. Ambos os overloads
incluem um termo de brand:

```ts
type NullablePrimaryKey<V> = PrimaryKey<V> | undefined;

// Com autogeração → o campo deve ser opcional E ter brand
ClassFieldDecoratorContext<This, NullableField<Value> & NullablePrimaryKey<Value>>;

// Sem autogeração → o campo deve ser obrigatório E ter brand
ClassFieldDecoratorContext<This, NotNullableField<Value> & PrimaryKey<Value>>;
```

Seis formas de declaração resolvem limpo:

| Declaração do campo | autogen? | Resultado |
| --- | --- | --- |
| `id!: PrimaryKey<number>` | não | ✓ aceita |
| `id?: PrimaryKey<number>` | sim | ✓ aceita |
| `id!: number` | não | ✗ rejeita (sem brand) |
| `id?: number` | sim | ✗ rejeita (sem brand) |
| `id?: PrimaryKey<number>` | não | ✗ rejeita (modificador `?` errado) |
| `id!: PrimaryKey<number>` | sim | ✗ rejeita (modificador `!` errado) |

Os quatro casos "errados" falham no call site do decorator com um erro
`Type ... is not assignable to ...`.

Este é um **segundo uso do padrão constraint-flip** no codebase — o primeiro sendo o enforcement
de nullability de `@Nullable` / `@NotNullable` via `NullableField<V>` / `NotNullableField<V>`.
Ver [stage-3-decorators.md](stage-3-decorators.md) para o padrão.

## Por que importa

- **Fecha o bug silencioso de `update`.** Antes do brand, `update({ name: 'x' })` passava no
  typecheck em entidades com PK autogerada (declarada `id?: number`) e produzia silenciosamente
  `WHERE id = NULL`. Com `update(entity: UnbrandedT<T> & PKInput<T>)`, `id` é obrigatório e
  não-`undefined` em tempo de compilação. Ver [autogeneration.md](autogeneration.md) para a
  metade upstream da mudança.
- **Estreita `findById` / `delete`.** `findById({})` e `findById({ name: 'x' })` não compilam
  mais.
- **Lado de leitura simétrico.** `findById`, `findOne`, `findMany` e `create` retornam `T` com
  brand (ou `PKOutput<T>`). O código do caller nunca precisa "lembrar" quais métodos retornam PKs
  com brand.
- **Call sites sem brand.** `c.id?.eq(1)` funciona porque o
  [conditions proxy](conditions-proxy.md) usa `Unbrand<T[K]>` por campo; `repo.findById({ id: 1 })`
  funciona porque `PKInput<T>` é a forma sem brand; o brand só aparece onde o usuário **declara**
  uma entidade.

## Armadilhas

### Construção manual de brand é rara; se precisar, use cast

Não existe helper `pk<V>(v: V): PrimaryKey<V>`. A maioria dos caminhos passa por métodos do repo,
que removem brands na entrada. Se um usuário precisar construir um valor com brand (ex.: montar
um literal `PKOutput<T>` num teste), `value as PrimaryKey<V>` é o idioma. Adiado até se provar
doloroso.

### `NonNullable<>` em `PKKeys<T>` é estrutural

PKs autogeradas são declaradas `id?: PrimaryKey<number>` — o tipo de `T['id']` é
`PrimaryKey<number> | undefined`. Sem `NonNullable<>`, o condicional
`T[K] extends PrimaryKey<unknown>` testaria a união diretamente e falharia. O `NonNullable<>`
remove o `undefined` primeiro.

### O brand não pode ser injetado automaticamente por um decorator

Decorators Stage-3 conseguem LER o tipo declarado de um campo, mas não conseguem injetar
informação de tipo nele. Logo a anotação `PrimaryKey<V>` precisa viver em toda declaração de
campo `@PrimaryColumn` — não existe "decorator esperto" que a adicione por você. É uma limitação
estrutural do dialeto, não uma feature faltando. Ver
[stage-3-decorators.md](stage-3-decorators.md).

## Exemplos

### Declaração

```ts
class User {
  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER, autogeneration: { dbSide: () => undefined } })
  id?: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  email!: string;
}

class OrderItem {
  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  orderId!: PrimaryKey<number>;

  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  productId!: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.INTEGER })
  @NotNullable
  quantity!: number;
}
```

### Uso

```ts
const userRepo = new Repository(User, db);

// Enforcement de PK em tempo de compilação
await userRepo.findById({}); // ✗ — PKInput<User> exige `id`
await userRepo.findById({ name: 'x' }); // ✗ — campo errado
await userRepo.findById({ id: 1 }); // ✓ — number puro; brand removido na entrada
await userRepo.update({ name: 'x' }); // ✗ — `id` obrigatório mesmo T['id'] sendo opcional

// Round-trip sem casts
const u = await userRepo.findById({ id: 1 });
if (u) await userRepo.update(u); // ✓ — T com brand é subtipo de UnbrandedT<T>

// PK composta
const itemRepo = new Repository(OrderItem, db);
await itemRepo.findById({ orderId: 1 }); // ✗ — productId faltando
await itemRepo.findById({ orderId: 1, productId: 2 }); // ✓
```

## Conexões

- [components/repository.md](../components/repository.md) — dono das quatro assinaturas que
  consomem o brand.
- [autogeneration.md](autogeneration.md) — declara PKs autogeradas como
  `id?: PrimaryKey<number>`; o modificador opcional em `T` é o que `create()` lê para decidir
  "omissível" em tempo de compilação.
- [conditions-proxy.md](conditions-proxy.md) — usa `Unbrand<T[K]>` por campo para que
  `c.id?.eq(1)` aceite um literal puro.
- [ADR 0008](../decisions/0008-pk-aware-compile-time.md) — a decisão que escolhe o brand sobre as
  alternativas de generic e só-runtime.
- [ADR 0005](../decisions/0005-no-any-type-driven-api.md) — a decisão de tipagem estrita que
  torna o padrão de brand enforceável.
