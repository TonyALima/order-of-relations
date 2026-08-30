# Lazy Query Builder

## Definição

Um **lazy query builder** acumula estado de query — predicados `WHERE`, ordenação, paginação,
escopo de herança — sem executar SQL. O SQL só é gerado e executado quando um método terminal é
chamado. No OOR o tipo é `QueryBuilder<T>`, construído dentro dos métodos de leitura do
repositório (`findMany`, `findOne`) e descartado após uma chamada terminal.

"Lazy" aqui significa *adiado até uma chamada terminal*, não "avaliado sob demanda pelo consumidor
das linhas". As linhas são buscadas avidamente assim que o terminal roda; o que é adiado é o ato
inteiro de executar.

## Como funciona

O builder é **mutável**, de dono único e vida curta. Seu estado interno são quatro campos:

```ts
private conditions: Condition[] = [];
private orderByClause: { column: keyof T; direction: 'ASC' | 'DESC' } | undefined;
private limitValue: number | undefined;
private offsetValue: number | undefined;
```

Condições de where e o filtro de discriminador de herança reduzem a entradas no array
`conditions` — a API de usuário para o último é o campo `inheritance: InheritanceSearchType` em
`FindOptions<T>` (ver [components/query-builder.md](../components/query-builder.md) e
[single-table-inheritance.md](single-table-inheritance.md)). Ordenação e paginação têm campos
próprios (`orderBy`, `limit`, `offset`).

O repositório constrói um `QueryBuilder<T>`, chama `applyOptions(options?)` para instalar o
callback `where` do usuário (e o escopo de herança), e então chama um método terminal. O builder
é descartado em seguida. Não existe hoje cenário em que dois consumidores seguram o mesmo
builder.

`where()` **substitui** as condições atacado a cada chamada — última-chamada-vence, não aditivo.
Ver [questions/apply-options-accumulation.md](../questions/apply-options-accumulation.md) para a
questão em aberto sobre inverter isso para acumulação.

Os métodos terminais hoje são exatamente dois:

- `getMany(): Promise<T[]>` — toda linha que casa. Resultado vazio é `[]`, nunca `null`.
- `getOne(): Promise<T | null>` — primeira linha de um `SELECT ... LIMIT 1`, ou `null`. Ambos os
  terminais dividem um template privado `executeSelect(addLimit)`.

Ausentes e reconhecidos como trabalho futuro: `getCount()`, `getExists()`, streaming. O formato
`getX(): Promise<X>` é o padrão; novos terminais entram sem perturbar a API de cláusulas.

Como o SQL só roda na chamada terminal, builders intermediários podem ser passados a helpers que
condicionalmente adicionam escopo de herança ou condições extras, sem que o helper precise
re-executar ou aceitar linhas já buscadas. *Isso* é o que a laziness compra, independentemente da
postura de mutabilidade.

## Por que importa

- **Composabilidade**: filtros, escopos e "queries base" podem ser expressos como funções sobre
  `QueryBuilder<T>`. Sem laziness, cada camada teria de re-executar ou cachear linhas.
- **Narrowing de tipos**: cada método pode refinar o tipo de resultado. `select(['id', 'name'])`
  pode estreitar `T` para `Pick<T, 'id' | 'name'>` no nível de tipos.
- **Previsibilidade**: o SQL roda em exatamente um site (a chamada terminal). Nenhuma query
  surpresa disparada por acidentes estilo `.toString()`.

## Exemplos

API real — `where` é um callback que recebe um
[conditions proxy](conditions-proxy.md) tipado, não um objeto plano:

```ts
// `findMany` é um wrapper fino do Repository que constrói um QueryBuilder,
// aplica as opções e chama getMany() internamente. O SQL dispara uma vez, no getMany.
const active = await userRepository.findMany({
  where: (u) => [u.active!.eq(true), u.deletedAt!.isNull()],
});
```

Quando composição/camadas são necessárias hoje, elas acontecem **dentro** de `findMany` /
`findOne` via o callback `where` e o campo `inheritance` de `FindOptions` — o builder é
construído, acumulado e terminado dentro de um único dono de vida curta. Não há handoff de
builder para o caller (`Repository.find()` não existe). Uma API futura poderia expor o builder
diretamente sem mudar a propriedade de execução lazy; a laziness é o invariante estrutural, não
quem segura a referência.

## Conexões

- [ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md) — a decisão.
- [components/query-builder.md](../components/query-builder.md) — a classe concreta, com o
  estado, a postura de mutabilidade e os métodos terminais.
- [repository-pattern.md](repository-pattern.md) — o ponto de entrada que envolve e delega a este
  tipo.
- [conditions-proxy.md](conditions-proxy.md) — o objeto tipado que o callback `where` recebe.
- [parameterized-sql.md](parameterized-sql.md) — a propriedade de segurança que o builder
  preserva em tempo de compilação do statement.
