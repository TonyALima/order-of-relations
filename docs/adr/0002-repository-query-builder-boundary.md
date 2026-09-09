# ADR-0002: Fronteira entre Repository e QueryBuilder

## Status

Accepted

## Contexto

`Repository<T>` é a fachada pública de persistência de uma entidade. No
estado atual, ele expõe `create()`, `update()`, `delete()`, `findById()`,
`findOne()` e `findMany()`; as duas últimas recebem `FindOptions<T>` e
retornam o resultado da consulta.

As leituras são implementadas por um `QueryBuilder<T>` interno. `findMany()`
e `findOne()` criam o builder, aplicam as opções e chamam, respectivamente,
`getMany()` e `getOne()`. `findById()` também o usa depois de validar a chave
primária. O builder transforma as condições e o escopo de herança em um
`SELECT` parametrizado para a conexão do `Database`.

Esta decisão preserva a intenção recuperável do ADR 0002 do vault legado.
Esse registro descrevia `Repository.find()` como uma entrega preguiçosa de um
builder ao consumidor e mencionava terminais adicionais. Essas APIs não fazem
parte do código atual: `Repository.find()` não existe e `QueryBuilder` não é
exportado pelo ponto de entrada público do pacote. Portanto, elas não podem
ser tratadas como contrato.

## Decisão

`Repository` permanece a única fronteira pública entre uma entidade e suas
operações de persistência. As consultas públicas são terminais:
`findMany()` retorna uma lista e `findOne()` ou `findById()` retornam uma
entidade ou `null`.

`QueryBuilder` permanece o mecanismo interno que concentra a construção e a
execução de consultas tipadas. Seu encadeamento e seus terminais são detalhes
de implementação usados pelo repositório; a aplicação consumidora configura
as leituras por `FindOptions<T>`, sem receber um builder.

## Alternativas consideradas

- Expor `Repository.find()` retornando `QueryBuilder`: rejeitada porque
  reintroduziria uma API histórica inexistente e ampliaria a superfície pública
  sem requisito atual.
- Executar cada leitura diretamente no `Repository`: rejeitada porque
  duplicaria no repositório a montagem de filtros, escopo de herança e SQL
  parametrizado já centralizada no builder.
- Exportar `QueryBuilder` como segunda entrada pública de consultas: rejeitada
  porque obrigaria a estabilizar seu encadeamento interno antes de haver um
  caso de uso público que o exija.

## Consequências

- Chamadores usam uma superfície pequena e terminal para persistir e consultar
  uma entidade; operações compostas atualmente cabem em `FindOptions<T>`.
- `Repository` pode manter as responsabilidades de chave primária, geração de
  chave e conversão de relações, enquanto `QueryBuilder` mantém a execução de
  `SELECT` tipados e parametrizados.
- Alterações no encadeamento interno do builder não criam um novo contrato do
  pacote. Uma futura API pública de composição deverá ser decidida e
  documentada explicitamente.

## Referências

- Vault legado: `wiki/decisions/0002-repository-with-lazy-query-builder.md`.
- Vault legado: `wiki/components/Repository.md` e
  `wiki/components/QueryBuilder.md`.
- Vault legado: `wiki/sources/drift-d1-repository-find.md`.
- Código e testes atuais: `src/core/repository/repository.ts` e
  `src/query-builder/query-builder.test.ts`.
