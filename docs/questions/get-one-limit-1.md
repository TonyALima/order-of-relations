# `QueryBuilder.getOne()` deveria emitir `LIMIT 1` em vez de fatiar no cliente?

> Status: **respondida** (2026-05-14) · Impacto: **baixo** · Esforço: **P** · Decidida por:
> commits `3095fbc` / `f8cdf14`

## Resposta

**Entregar `LIMIT 1` agora.** Resolvida em 2026-05-14. `QueryBuilder.getOne()` emite um
`LIMIT 1` no SQL, de modo que o banco para após a primeira linha que casa; não busca mais o
result set inteiro para fatiar no cliente.

**Racional.** Três opções estavam na mesa (entregar agora, esperar `orderBy`, fatiar sempre). A
opção 1 venceu: o argumento de não-determinismo contra entregar cedo era um red herring — a
abordagem anterior com `rows[0]` *já era* não-determinística sem `ORDER BY`. As duas abordagens
retornam "alguma linha que casa" do ponto de vista do banco. `LIMIT 1` é estritamente melhor com
determinismo idêntico: bem menos dados trafegando no wire, bem menos materializado no heap JS em
conjuntos filtrados grandes. Quando `orderBy` aterrissou, compôs limpo por cima — sem migração
adicional.

**Mudanças de código.** Dois commits na `main`:

- `3095fbc` — `perf(query-builder): emit LIMIT 1 in getOne instead of client-side slicing`.
- `f8cdf14` — `refactor(query-builder): unify executeSelect into single composable template`.

O refactor subsequente é estruturalmente significativo. O corpo de `getMany()` tinha dois caminhos
de retorno divergentes (`SELECT *` sem condições, `SELECT cols` com condições). Adicionar
`LIMIT 1` aos dois ingenuamente produziria quatro caminhos de retorno. Em vez disso, os dois
terminais colapsaram num único template `executeSelect(addLimit)` com fragmentos SQL opcionais
(`cols`, `whereClause`, `limitClause`); um `ORDER BY` / `OFFSET` futuro virou um append de
fragmento de uma linha em vez de uma explosão combinatória de branches. Também unificou em
`SELECT ${cols}` em todo lugar — `SELECT *` vazaria colunas do banco não presentes nos metadados
da entidade, quebrando o contrato orientado a metadados.

**Teste.** Dirigido por TDD. `src/query-builder/query-builder.test.ts` passou a afirmar que
`getOne()` não delega mais a `getMany()` (espiona `getMany` e espera zero chamadas). Estava red
antes da mudança, green depois.

---

*A questão original e seu racional são preservados abaixo como trilha de auditoria do estado
pré-resolução.*

## Questão

`QueryBuilder.getOne()` chamava `getMany()` e retornava `rows[0] ?? null`. Deveria, em vez disso,
emitir uma cláusula `LIMIT 1` no SQL, para que o banco retorne no máximo uma linha desde o
início?

## Por que importava

- **Performance em conjuntos filtrados grandes.** Um `getOne()` contra um `where` que casa 50.000
  linhas buscava as 50.000, trafegava todas pelo wire, fazia parse no cliente e descartava
  49.999. Com `LIMIT 1`, o banco para após a primeira que casa.
- **Pressão de memória.** O `T[]` intermediário de resultado completo existia no heap JS, mesmo
  que 99,998% dele fosse imediatamente descartado.
- **Honestidade.** "Get one" semanticamente se compromete com uma. A implementação não refletia
  isso.

## Por que o comportamento antigo existia

Deliberação documentada: *"Hoje não adiciona `LIMIT 1` ao SQL; fatia o resultado no cliente. Tudo
bem para os result sets pequenos que a API atual mira, e é uma mudança de uma linha quando deixar
de ser."* Era uma decisão consciente de "entregue o mais simples, troque quando incomodar" — não
um descuido.

## Considerações que estavam abertas

- **`getOne()` era semanticamente equivalente a "a primeira linha de `getMany()`".** Com
  `LIMIT 1`, ordenação passa a importar: idealmente haveria uma ordem estável, mas o builder
  ainda não suportava `orderBy` à época. Entregar `LIMIT 1` sozinho poderia expor
  não-determinismo que a abordagem de fatia escondia discretamente.
- **Acoplamento a ordenação.** Uma vez que `orderBy` aterrissasse como feature do builder,
  `LIMIT 1` viraria a escolha obviamente correta.

## Questões relacionadas

- [apply-options-accumulation](apply-options-accumulation.md) — adiada separadamente, da mesma
  fonte.
