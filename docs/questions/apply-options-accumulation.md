# `QueryBuilder.applyOptions()` deveria acumular condições where em vez de substituir?

> Status: **aberta** (adiada) · Impacto: **baixo** · Esforço: **P**

## Questão

`QueryBuilder.applyOptions()` hoje **substitui** as condições de where atacado a cada chamada
(`this.conditions = results`). Chamar `applyOptions({ where: A })` seguido de
`applyOptions({ where: B })` descarta as condições de `A` inteiramente.

Deveria, em vez disso, **acumular** — fazer AND das novas condições no array existente — para
casar com a semântica aditiva que a maioria das APIs de builder tem?

## Por que o comportamento atual existe

- **Por que substituir hoje:** `findMany(options?)` / `findOne(options?)` do repositório chamam
  `applyOptions` exatamente uma vez por builder. Não existe cenário no codebase atual em que duas
  chamadas `applyOptions` no mesmo builder sejam intencionais. Substituir é o default seguro —
  não pode surpreender o caminho de chamada dominante.
- **Por que vale revisitar:** a convenção na maioria dos ecossistemas de ORM/SQL builder (Knex,
  Kysely, TypeORM) é aditiva. Um caller futuro compondo escopos
  (`baseQuery.applyOptions(scopeA).applyOptions(scopeB)`) esperaria AND, receberia substituição e
  escreveria um bug.

## Por que importa

- **Surpresa de API.** "Builder" carrega uma expectativa. Usuários vindos de outros ecossistemas
  vão presumir semântica aditiva por default, e a falha (condições descartadas em silêncio) é
  difícil de notar no call site.
- **Composição é a *razão* da laziness.** O
  [Lazy Query Builder](../concepts/lazy-query-builder.md) torna a execução adiada possível
  justamente para a composição em camadas ser segura. Um `applyOptions` não-aditivo anula parte
  desse benefício.

## Contra-argumentos a inverter

- **Última-chamada-vence é uma semântica real**, usada deliberadamente por algumas bibliotecas
  (quando applyOptions é tratado como "configuração, não composição"). A escolha não é *errada*;
  é só *diferente da convenção dominante*.
- **Acumulação implícita pode mascarar bugs.** Um reset esquecido entre dois caminhos de query
  não relacionados pode produzir uma query que faz AND de filtros não relacionados. Substituir
  torna "builder novo, estado novo" óbvio.
- **A correção é uma linha em qualquer direção.** Isto é uma escolha deliberada agora; trocar
  depois é uma mudança de código de uma linha, mas uma mudança de *semântica de API* breaking.

## O que mudaria no codebase

Se invertido para aditivo:

- Corpo de `applyOptions()`: trocar `this.conditions = results` por
  `this.conditions.push(...results)`.
- Testes — adicionar testes fixando o comportamento aditivo (ex.: duas chamadas `applyOptions`
  produzem uma query cujo `WHERE` é `(A) AND (B)`).
- Wrappers do repositório (`findMany`, `findOne`) — verificar que não dependem da semântica de
  substituição.
- Documentação — a seção "substitui, não acumula" de
  [components/query-builder.md](../components/query-builder.md) inverte.

## O que fecharia esta questão

- **Aparece um caso de uso concreto de composição** — inverter para aditivo, registrar ADR se a
  mudança for não trivial.
- **Decisão de manter substituição permanentemente** — anotar aqui por quê, marcar como
  `answered`.
- **Híbrido** — introduzir um método separado (`andWhere`?) para composição aditiva, deixando
  `applyOptions` como substituição.

## Questões relacionadas

- [get-one-limit-1](get-one-limit-1.md) — adiada separadamente, da mesma fonte.
