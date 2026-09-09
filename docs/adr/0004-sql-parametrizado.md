# ADR-0004: Usar somente SQL parametrizado

## Status

Accepted em 2026-04-29.

## Contexto

`SQL` do Bun compõe consultas por tagged templates e oferece
`sql.unsafe(text)` para executar texto SQL cru. A segunda opção ignora o
escaping e permite que uma interpolação de entrada altere a sintaxe da
consulta.

Uma auditoria dos caminhos do ORM identifica três classes de interpolação:

- Em DML, `Repository` e `QueryBuilder` passam valores de entidades e filtros
  aos templates `sql`; `sql(object)` e `sql(valor)` fazem o binding desses
  valores. `sqlJoin` une fragmentos sem transformá-los em strings.
- Nomes de tabela e coluna não são valores parametrizáveis. Eles vêm dos
  metadados e são passados a `sql(nome)`, o helper de identificadores do Bun,
  que os delimita adequadamente.
- A DDL de `Database` usa tipos de coluna, operadores, direções de ordenação e
  cláusulas definidos pelo ORM como fragmentos fechados. Em particular,
  `COLUMN_TYPE` limita os tipos possíveis. A sequência de DDL para herança usa
  `.simple()` por conter duas instruções; o protocolo simples do Bun não aceita
  parâmetros de valores.

Logo, não é correto afirmar que a DDL use parâmetros para valores: seus
identificadores precisam estar no texto SQL e seus demais elementos dinâmicos
são fragmentos sintáticos fechados. Um `DEFAULT` fornecido por `dbSide` também
é uma expressão de DDL, não um valor a ser vinculado.

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

## Alternativas consideradas

- Permitir `sql.unsafe` com comentário obrigatório foi rejeitado: o aviso pode
  desaparecer e o padrão inseguro pode ser copiado sem contexto.
- Oferecer um helper de entrada confiável sobre `sql.unsafe` foi rejeitado:
  ele só desloca a mesma decisão de segurança para outra abstração.

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
