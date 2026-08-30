# Repository Pattern

## Definição

Um **Repository** é o objeto único responsável pela persistência de um tipo de entidade. Ele
media entre o domínio (classes de entidade tipadas) e o armazenamento (linhas PostgreSQL),
expondo operações de CRUD e um ponto de entrada de composição para leituras.

No OOR o tipo é `Repository<T>`, parametrizado pela classe da entidade. Um repositório por
entidade; uma entidade por repositório.

## Como funciona

`Repository<T>` expõe uma superfície **estreita**, dividida por eixo:

- **Operações por chave (linha única).** `create(entity)`, `findById(key)`, `update(entity)`,
  `delete(key)`. As quatro passam por um único portão privado `requirePrimaryKey`, que decide o
  que é "completo" com base nos metadados de `autogeneration` de cada coluna PK. Mesmo portão,
  mesmo erro (`IncompletePrimaryKeyError`).
- **Leituras compostas.** `findOne(options?)` e `findMany(options?)` são os pontos de entrada de
  composição: cada um aceita um `FindOptions<T>`, constrói um `QueryBuilder<T>` internamente,
  aplica as opções e chama o terminal (`getOne()` / `getMany()`) de uma vez. `findById` é o único
  leitor por chave; os outros métodos de leitura são donos do builder por exatamente uma chamada.

A regra de bolso: **operações de linha única por chave no `Repository`; qualquer coisa composta
via `QueryBuilder`.**

`Repository<T>` é construído diretamente hoje: `new Repository(User, db)`. O decorator
`@InjectRepository(Entity)` e o [container de DI](di-container.md) que o acompanharia **ainda não
estão implementados** — ver a nota de implementação na
[ADR 0003](../decisions/0003-singleton-di-container.md).

## Como os decorators moldam o contrato

O mecanismo que torna `create(entity: UnbrandedT<T>)` enforceável em tempo de compilação:

- `@NotNullable` e `@Nullable` não apenas escrevem `NULLABLE_KEY` para metadados de runtime —
  eles restringem o *tipo TypeScript declarado* do campo via os mapped types
  `NullableField<Value>` e `NotNullableField<Value>`.
- `@PrimaryColumn({ autogeneration })` produz um `NullableField<Value>` (opcional em `T`);
  `@PrimaryColumn` sem `autogeneration` produz um `NotNullableField<Value>` (obrigatório).
- Ambos os overloads de `@PrimaryColumn` exigem ainda o
  [brand `PrimaryKey<V>`](primary-key-brand.md) no tipo do campo — `id!: PrimaryKey<number>` (sem
  autogeração) ou `id?: PrimaryKey<number>` (com autogeração). É isso que
  `findById`/`delete`/`update` consomem para derivar `PKInput<T>` estruturalmente.

O resultado: a declaração da classe da entidade *é* a fonte da verdade. `create()` não precisa de
uma verificação separada de "esse input é válido?" — o TypeScript já sabe quais campos são
obrigatórios, e um campo faltando é erro de compilação. O portão de runtime `requirePrimaryKey`
existe para callers que burlam a checagem de tipos (JS sem tipos, dispatch dinâmico).

É para isso que a [ADR 0005](../decisions/0005-no-any-type-driven-api.md) é estrutural: `any`
apagaria o enforcement do lado dos tipos e degradaria o contrato para só-runtime. A verificação
dupla compilação + runtime funciona *porque* o codebase proíbe `any`.

## Por que importa

- Estabelece uma **fronteira limpa**: preocupações de persistência ficam isoladas em uma classe
  por entidade. Serviços de domínio não emitem SQL; chamam `repo.X()`.
- Habilita **substituição** em testes: um teste pode injetar um repositório fake sem tocar no
  plumbing de SQL.
- A divisão trivial/composta impede que a API vire um saco de métodos sobrecarregados (o modo de
  falha que assombra ORMs mais velhos).

## Exemplos

Estilo atual dos `examples/` — construção direta, sem DI ainda:

```ts
const userRepository = new Repository(User, db);

// Escrita por chave. Retorna PKOutput<User> com APENAS os campos de chave
// primária, com brand (não uma entidade hidratada — chame findById() se
// precisar da linha completa).
const { id } = await userRepository.create({ email: 'a@b.com', name: 'Alice' });

// Leitura por chave.
const user = await userRepository.findById(id);

// Leitura composta — `where` é um callback que recebe um proxy tipado.
// Ver concepts/conditions-proxy.md. findMany / findOne constroem um
// QueryBuilder internamente, aplicam as opções e chamam o terminal de uma vez.
const active = await userRepository.findMany({
  where: (u) => [u.active!.eq(true)],
});
```

Ver `examples/basic-crud/services/UserService.ts` para o padrão canônico de construção sem DI.

Ergonomia planejada, **quando o DI aterrissar** (hoje aspiracional):

```ts
@Service
class UserService {
  @InjectRepository(User)
  private repo!: Repository<User>;
}
```

## Conexões

- [ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md) — a decisão que fixa a
  fronteira.
- [components/repository.md](../components/repository.md) — a classe concreta, com as seis
  operações e o portão `requirePrimaryKey`.
- [lazy-query-builder.md](lazy-query-builder.md) / [components/query-builder.md](../components/query-builder.md)
  — o tipo para o qual as leituras compostas delegam.
- [autogeneration.md](autogeneration.md) — a estratégia que decide quais colunas PK são
  omissíveis no `create()`.
- [conditions-proxy.md](conditions-proxy.md) — o objeto tipado que o callback `where` recebe.
- [primary-key-brand.md](primary-key-brand.md) — o marcador de tipos que os quatro métodos com PK
  consomem.
