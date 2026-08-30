# ADR 0008 — Enforcement de PK em tempo de compilação via brand `PrimaryKey<V>`

- **Status:** aceita
- **Data:** 2026-04-30
- **Decisor:** Tony Albert

## Contexto

O trabalho anterior que endureceu `Repository.create(entity: T)` para exigir os campos
obrigatórios em tempo de compilação deixou três dos quatro métodos restantes que usam PK em um
estado pior do que deveriam:

- `findById(key: Partial<T>)` e `delete(key: Partial<T>)` aceitavam **qualquer** subconjunto de
  `T`. Frouxo no nível de tipos; barulhento em runtime via `IncompletePrimaryKeyError`.
- `update(entity: T)` era um **bug silencioso de runtime**: com autogeração, PKs autogeradas são
  declaradas `id?: number` — opcionais em `T`. Logo o próprio `T` permitia
  `update({ name: 'x' })`. O corpo montava `WHERE id = NULL`, não casava nenhuma linha e retornava
  em silêncio.

`findMany(options?)` e `findOne(options?)` não eram afetados — recebem opções de query, não uma
forma crua de entidade.

O enforcement de PK em tempo de compilação é estruturalmente restrito: o TypeScript não tem como
saber quais campos de `T` são PKs. O decorator guarda a "PK-ness" em metadados de **runtime**.
Decorators Stage-3 conseguem LER o tipo declarado de um campo, mas **não conseguem injetar**
informação de tipo nele. Logo a fonte da verdade para identidade de PK só pode vir de dois
lugares: (1) um marcador que o usuário escreve nos tipos declarados dos campos de PK, ou (2) um
generic que o usuário passa na construção do `Repository`. Não existe terceira opção.

## Decisão

**Adotar a Opção A: um brand estrutural no tipo do campo, `PrimaryKey<V>`.**

```ts
declare const __pkBrand: unique symbol;
export type PrimaryKey<V> = V & { readonly [__pkBrand]: true };
export type Unbrand<V> = V extends PrimaryKey<infer U> ? U : V;
```

Todo campo de chave primária é declarado com o brand: `id!: PrimaryKey<number>` (ou
`id?: PrimaryKey<number>` para autogeração). Os dois overloads de `@PrimaryColumn` ganham um
termo de brand na constraint de `ClassFieldDecoratorContext` — declarar um `@PrimaryColumn` em
campo sem brand passa a ser erro de tipo no call site do decorator.

As assinaturas do Repository consomem o brand para derivar as formas de PK:

```ts
findById(key: PKInput<T>):                  Promise<T | null>;
delete(key: PKInput<T>):                    Promise<void>;
update(entity: UnbrandedT<T> & PKInput<T>): Promise<void>;
create(entity: UnbrandedT<T>):              Promise<PKOutput<T>>;
```

Ver [concepts/primary-key-brand.md](../concepts/primary-key-brand.md) para a maquinaria de tipos
completa e [components/repository.md](../components/repository.md) para o comportamento por
método.

## Consequências

### Positivas

- **Enforcement de PK em tempo de compilação em todo método que usa PK.** `findById({})`,
  `findById({ name: 'x' })` e `update({ name: 'x' })` (em entidades com autogeração) viram erros
  de compilação. O bug silencioso de `update` é fechado no nível de tipos.
- **Sem divergência runtime/compilação.** O brand é verificado no site de declaração de
  `@PrimaryColumn`, então o tipo do campo e os metadados do decorator não podem divergir.
- **Call sites sem brand.** A assimetria do brand (subtipo na saída, supertipo na entrada via
  `Unbrand<V>`) mantém o código do usuário exatamente como antes — `repo.findById({ id: 1 })`,
  `c.id?.eq(1)`. O brand só aparece no site de **declaração**.
- **Lado de leitura simétrico.** `findById`, `findOne`, `findMany` e `create` retornam entidades
  com brand (ou `PKOutput<T>`). Round-trips como `repo.update(await repo.findById({ id }))`
  funcionam sem casts.
- **Consistente com a direção existente.** Completa o enforcement de compilação que
  `create(entity: T)` começou.

### Negativas / trade-offs

- **Custo de migração: toda declaração de PK muda.** ~15-25 sites neste codebase, todos em
  entidades ou fixtures de teste. Migração mecânica de search-and-replace, sem mudança de lógica.
- **`PrimaryKey<V>` é visível no site de declaração** e pode ser confundido com um wrapper de
  runtime. Não é — o brand é puramente um construto de tipos. A documentação precisa compensar.
- **O encanamento interno de tipos fica mais pesado.** `PKKeys<T>`, `UnbrandedT<T>`, `PKInput<T>`,
  `PKOutput<T>` são mapped types não triviais; sua interação com `NonNullable<>` e preservação de
  modificadores opcionais exige cuidado. (O parâmetro de `requirePrimaryKey` teve de ser
  ampliado de `Partial<T>` para `PKInput<T> | UnbrandedT<T>` porque as novas formas não eram
  atribuíveis a `Partial<T>`.)

### Neutras

- **O `requirePrimaryKey` de runtime continua no lugar.** A manchete é o enforcement de
  compilação; o portão de runtime é o piso para callers que burlam tipos com cast
  (`update(data as User)`).
- **A superfície pública continua mínima.** `PrimaryKey<V>` vai no barrel público; `PKInput<T>`,
  `PKOutput<T>`, `UnbrandedT<T>`, `Unbrand<V>` ficam internos até se provarem necessários.

## Alternativas consideradas

### B. `Repository<T, PK extends keyof T>` genérico

O usuário passa as chaves de PK explicitamente: `new Repository<User, 'id'>(User, db)`.

- **Prós:** nenhuma mudança na declaração de entidades.
- **Contras:** verboso na construção; **o TypeScript não pega divergência entre o generic `PK` e
  os metadados de `@PrimaryColumn`**. Declarar `Repository<User, 'name'>` passaria no typecheck em
  silêncio e divergiria da verificação de PK em runtime. **Para uma biblioteca publicável, isso é
  um footgun inaceitável.**

Esse foi o argumento desqualificante: um autor de biblioteca não pode confiar que usuários
manterão duas declarações de fonte da verdade em sincronia quando o sistema de tipos não ajuda.

### C. Endurecimento só em runtime

Não mudar tipos. Adicionar uma verificação de runtime mais estrita no início de `update()` que
rejeita valores de PK ausentes ou `undefined`.

- **Prós:** menor mudança, sem impacto de API, sem migração.
- **Contras:** o sistema de tipos não ganha nada — `findById({})` continua compilando;
  `update({ name: 'x' })` continua compilando. Fecha o caso do bug silencioso, mas é **um passo
  atrás** em relação à direção de precisão de tipos que o trabalho anterior estabeleceu.

### Por que A vence

Dois argumentos convergiram para o brand:

1. **Consistência com a direção existente.** O trabalho anterior pagou um custo real de migração
   por corretude em compilação; terminar o trabalho é um passo marginal pequeno.
2. **O footgun de B é inaceitável.** A divergência runtime/compilação de B é exatamente o modo de
   falha que o enforcement de A no site de declaração impede.

O custo de A — `id!: PrimaryKey<number>` em toda declaração de PK — é limitado e mecânico.

## Referências

- [Conceito: PrimaryKey Brand](../concepts/primary-key-brand.md)
- [Componente: Repository](../components/repository.md)
- [ADR 0005 — `no-any` estrito](0005-no-any-type-driven-api.md), a base desta decisão
