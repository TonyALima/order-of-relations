# ADR 0002 — Repository como ponto de entrada, QueryBuilder lazy por baixo

- **Status:** aceita
- **Data:** 2026-04-29
- **Decisor:** Tony Albert

## Contexto

Um ORM precisa expor duas ergonomias muito diferentes:

- **Casos triviais** — `repo.findOne({ ... })`, `repo.create({ ... })` — devem ler como um
  key/value store tipado.
- **Casos compostos** — filtros dinâmicos, ordenação, paginação, joins — devem ler como SQL,
  porém tipados.

Se uma única API tentar cobrir ambos, ela incha. Se duas APIs forem expostas no mesmo nível, o
consumidor não sabe qual usar.

## Decisão

**`Repository<T>` é o ponto de entrada único para a persistência de uma entidade.** Operações
simples (`findOne`, `findMany`, `findById`, `create`, `update`, `delete`) executam SQL
diretamente. A composição de queries acontece em um `QueryBuilder<T>` **lazy**, que acumula
cláusulas e só executa em chamadas terminais (`getMany()`, `getOne()`).

> **Nota de implementação (2026-04-29).** O texto original desta ADR previa um método público
> `Repository.find()` que devolveria o `QueryBuilder<T>` sem executar SQL. Esse método **não
> existe** na implementação atual: o builder é construído internamente por `findMany`/`findOne`,
> usado uma vez e descartado. A superfície pública de leitura são os métodos terminais do
> `Repository` com `FindOptions<T>`; a construção direta de `QueryBuilder` é possível, mas é uma
> escotilha interna, não API documentada.

## Consequências

### Positivas

- O modelo mental é unidirecional: métodos simples no `Repository`, composição no `QueryBuilder`.
  O consumidor sempre sabe onde está.
- A execução lazy torna o builder componível com segurança — dá para passar uma query
  parcialmente montada adiante, adicionar `where()` e só executar no ponto que sabe que ela está
  completa.
- Desacopla naturalmente a superfície de leitura da de escrita: escritas vão pelo `Repository`,
  leituras escalam pelo `QueryBuilder`.
- **Mantém o anti-padrão N+1 visível e analisável.** Escolher o padrão Data Mapper (Repository)
  em vez de Active Record faz de todo acesso ao banco uma chamada explícita e nomeada — um N+1
  sempre aparece como um loop literal sobre `repo.findX()`, nunca como uma query escondida atrás
  de uma propriedade de relação lazy. O estudo
  [REFORMULATOR (ASE '22)](../research/reformulator-n-plus-one.md) mostra por que isso importa
  (N+1 causa lentidão de até 38,58× e é prevalente em código real) e que chamadas explícitas de
  ORM são pré-condição para detectar e refatorar o problema por análise estática. O builder lazy
  reforça isso: acumula cláusulas, mas nunca dispara uma query por linha implicitamente.

### Negativas / trade-offs

- Dois tipos para aprender. O consumidor precisa entender a fronteira entre Repository e
  QueryBuilder.
- Risco de footgun: quem esquece a chamada terminal fica com um `QueryBuilder` em vez de um array
  de linhas. O narrowing de tipos na API ajuda, mas não elimina.

### Neutras

- A fronteira impõe disciplina: tudo que precisa executar SQL implicitamente pertence ao
  `Repository`; tudo que deve compor vive no `QueryBuilder`.

## Alternativas consideradas

- **API fluente em classe única (estilo `Repository.createQueryBuilder()` do TypeORM)** —
  rejeitada: turva a fronteira; casos simples e compostos dividem superfície demais.
- **Execução eager na composição** — rejeitada: impossibilita compor e força todos os filtros a
  serem passados de uma vez.
- **Sem repositórios, só query builder cru (estilo Drizzle)** — rejeitada: CRUD trivial fica
  verboso.

## Referências

- [Conceito: Repository Pattern](../concepts/repository-pattern.md)
- [Conceito: Lazy Query Builder](../concepts/lazy-query-builder.md)
- [Conceito: Data Mapper e o argumento da analisabilidade](../concepts/orm-patterns.md)
- [Pesquisa: REFORMULATOR (ASE '22)](../research/reformulator-n-plus-one.md)
