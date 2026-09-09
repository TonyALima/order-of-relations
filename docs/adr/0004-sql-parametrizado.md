# ADR-0004: Usar somente SQL parametrizado

## Status

Accepted em 2026-04-29.

## Contexto

`sql` é uma tagged template do Bun para criar consultas parametrizadas: os
valores interpolados são enviados separadamente da instrução e não alteram sua
sintaxe. Já `sql.unsafe(text)` insere `text` diretamente na consulta, sem
parametrização nem escaping. Por isso, usá-lo com dados externos pode permitir
injeção de SQL. Como o ORM monta consultas a partir de valores e metadados,
precisamos definir explicitamente qual mecanismo é permitido em cada caso.

## Decisão

`sql.unsafe` é proibido em todo o código do ORM. Proteção contra injeção é uma
propriedade de correção da biblioteca, não uma convenção opcional para quem a
consome.

Valores devem ser interpolados somente em templates `sql` ou nos helpers de
objeto e array do Bun. Identificadores dinâmicos devem passar por `sql(nome)`;
nunca são concatenados ao texto da consulta. Fragmentos que ocupam posições de
sintaxe — como tipos de DDL, operadores e direções — devem vir de conjuntos
fechados definidos pelo ORM. Callbacks `dbSide` podem produzir apenas uma
expressão de DDL confiável composta dessa forma, sem dados externos nem
`sql.unsafe`.

## Consequências

- A superfície de injeção do ORM fica restrita por construção para valores e
  por quoting ou conjuntos fechados para as posições que não aceitam
  parâmetros.
- Revisões devem rejeitar `sql.unsafe`, concatenação de SQL e novos fragmentos
  de sintaxe de origem aberta.
- Casos futuros que precisem de nova sintaxe SQL devem modelá-la como um
  fragmento fechado ou ampliar a API tipada, em vez de abrir uma escotilha de
  texto cru.

## Referências

- [Bun SQL](https://bun.sh/docs/runtime/sql)
- [Arquitetura: integração SQL](../architecture.md#integração-sql)
