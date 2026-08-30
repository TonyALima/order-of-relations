# O `QueryBuilder` deveria suportar condições booleanas AND / OR / aninhadas?

> Status: **aberta** (adiada por design — listada explicitamente no escopo do
> [QueryBuilder](../components/query-builder.md)) · Impacto: **alto** · Esforço: **G**

## Questão

Hoje o callback `where` retorna uma lista plana `(Condition | undefined)[]`, e o compositor de
SQL une essas entradas com `AND`. Não há como expressar:

```ts
// "usuários ativos com email terminando em @paggo.ai, OU qualquer admin"
userRepo.findMany({
  where: (u) => [
    /* (u.active.eq(true) AND u.email.like('%@paggo.ai')) OR u.role.eq('admin') */
  ],
});
```

O OOR deveria estender o builder para suportar árvores booleanas de verdade — `AND`, `OR` e
(provavelmente) `NOT` sobre grupos aninhados de condições?

## Por que importa

- **Aplicações reais batem nisso no primeiro dia.** "Clientes em São Paulo OU com > R$10 mil em
  lifetime spend" é uma query de relatório rotineira. Hoje o único caminho seria descer para SQL
  cru — mas o OOR não tem escotilha `qb.raw(...)` (ver
  [ADR 0004](../decisions/0004-parameterized-sql-only.md)) e está firmemente comprometido em
  mantê-la assim. Sem OR, usuários rodariam duas queries e fariam merge em JS (risco de
  corretude para ordenação / dedup / paginação), ou abandonariam o builder por chamadas diretas,
  perdendo o tratamento type-safe de identificadores e valores que o
  [Conditions Proxy](../concepts/conditions-proxy.md) garante.
- **AND-only é uma API assimétrica.** A convenção "lista = AND" é intuitiva, mas com perdas:
  codifica *um* operador booleano estruturalmente e fecha a porta para o outro. Usuários vindos
  de TypeORM, Prisma ou Drizzle esperam um campo explícito `or:` ou combinadores
  `Op.or` / `Or(...)` — ver [comparisons/](../comparisons/README.md) para no que o campo
  convergiu.
- **Coexistência com o discriminador STI.** Leituras
  [STI](../concepts/single-table-inheritance.md) hoje empilham um predicado de discriminador que
  entra em AND com as condições do usuário. Quando OR existir no nível do usuário, a questão
  vira: o filtro de discriminador embrulha o predicado do usuário como
  `(predicado_usuario) AND discriminator = ...`, ou vira um nó irmão? O truque atual de "empilhar
  no array" para de funcionar assim que o array representa uma árvore.
- **Argumento de contribuição, não lacuna.** As comparações com TypeORM, Prisma e Drizzle se
  apoiam hoje no tratamento type-safe de identificadores e no invariante sem-`unsafe`. Um design
  de árvore booleana com escopo — preservando ambos — fortalece esse argumento; uma superfície
  permanentemente AND-only acaba por miná-lo.

## Comportamento atual (para a questão não decair)

Mecânica hoje:

- `where: (conditions: Conditions<T>) => (Condition | undefined)[]` — o callback retorna um array
  plano.
- `applyOptions()` roda o callback, valida que cada entrada não é `undefined` (rejeita com
  `UndefinedWhereConditionError` carregando o índice ofensor) e atribui o resultado a
  `this.conditions: Condition[]`.
- `getMany()` percorre `this.conditions` e une os fragmentos com o token AND via `sqlJoin`, usando
  `opFragments` como mapa fechado de operadores e `sql(c.columnName)` para interpolação segura de
  identificadores.

## Esboço do espaço de design

Três formas de API candidatas. Nenhuma é endossada; o objetivo desta seção é tornar os
trade-offs visíveis para um ADR futuro escolher deliberadamente.

### Opção A — Helpers combinadores `Or` / `And` (estilo TypeORM / Sequelize)

Expor combinadores que produzem nós compostos de `Condition`:

```ts
import { Or, And, Not } from 'order-of-relations';

userRepo.findMany({
  where: (u) => [
    Or(
      And(u.active!.eq(true), u.email!.like('%@paggo.ai')),
      u.role!.eq('admin'),
    ),
  ],
});
```

**Prós:**

- Menor perturbação da forma de tipos: `where` continua retornando `(Condition | undefined)[]`. O
  nível externo do array continua AND; os combinadores introduzem árvores internas.
- Compõe naturalmente — `Or(...conds)`, `And(...conds)` aceitam filhos variádicos, incluindo
  outros resultados de combinador.
- Joga bem com o validador `UndefinedWhereConditionError` existente: cada combinador é um único
  nó `Condition` do ponto de vista do validador.

**Contras:**

- Helpers importados vivem fora do proxy, então a garantia de type safety vem de `Condition` ser
  bem tipado na construção, não do proxy em si. Aceitável, mas vale fixar em testes.
- `Not` é um wrapper unário que precisa de regras próprias de composição na emissão de SQL
  (parenthesização em volta da subárvore negada).

### Opção B — Árvore de condições em forma de objeto (estilo Prisma)

Substituir o `(Condition | undefined)[]` plano por uma estrutura de objeto recursiva:

```ts
userRepo.findMany({
  where: {
    OR: [
      { AND: [{ active: { eq: true } }, { email: { like: '%@paggo.ai' } }] },
      { role: { eq: 'admin' } },
    ],
  },
});
```

**Prós:**

- Sem indireção de callback — a cláusula where é um valor serializável, amigável a construção
  programática (ex.: montar queries a partir de parâmetros de URL).
- Casa com o que Prisma / Drizzle provaram que usuários conseguem segurar na cabeça.

**Contras:**

- **Substitui** o mecanismo inteiro do [Conditions Proxy](../concepts/conditions-proxy.md), não o
  estende. A forma de callback atual compra validação de nomes de coluna em tempo de compilação
  que um literal de objeto não consegue igualar sem abrir mão de tipagem estrutural de valores.
  Recuperar essa type safety em APIs em forma de objeto exige maquinaria pesada de mapped types.
- Diverge semanticamente da convenção atual "where é uma lista AND plana" em vez de
  generalizá-la. Custo de migração maior para qualquer código futuro já escrito contra a API de
  hoje.

### Opção C — Builder de method-chaining (estilo TypeORM `.where().andWhere().orWhere()`)

Expor `qb.andWhere(callback)` / `qb.orWhere(callback)` no builder lazy:

```ts
new QueryBuilder(User, db)
  .where((u) => [u.active!.eq(true), u.email!.like('%@paggo.ai')])
  .orWhere((u) => [u.role!.eq('admin')])
  .getMany();
```

**Prós:**

- Mutacional, casa com a postura de mutabilidade existente do builder
  ([components/query-builder.md](../components/query-builder.md) § Mutabilidade).

**Contras:**

- Precedência dependente de ordem é um footgun: `where(A).orWhere(B).andWhere(C)` é ambíguo entre
  `(A OR B) AND C` e `A OR (B AND C)`. A resolução do TypeORM é "esquerda para a direita", que é
  exatamente o padrão surpreendente-em-PR-review que a discussão de
  [decorator-order-independence](decorator-order-independence.md) sinalizou em outro lugar.
- Introduz múltiplos caminhos em forma de `applyOptions`, em conflito com a decisão "applyOptions
  substitui atacado" (ver [apply-options-accumulation](apply-options-accumulation.md)). Duas
  questões abertas viram uma questão maior só.

## O que mudaria no codebase

Superfície aproximada de mudança para a **Opção A** (o caminho de menor atrito):

- `src/query-builder/types.ts` — estender o tipo `Condition` de um `{ columnName, op, value }`
  plano para uma união discriminada:
  `{ kind: 'leaf', ... } | { kind: 'and' | 'or', children: Condition[] } | { kind: 'not', child: Condition }`.
- `src/query-builder/combinators.ts` — módulo novo exportando `And`, `Or`, `Not`. Cada um retorna
  uma `Condition` do `kind` correspondente.
- `src/query-builder/query-builder.ts` — a composição de SQL de `getMany()` vira recursiva:
  percorre a árvore, parenthesiza em nós de grupo, usa `sqlJoin` com `' AND '` / `' OR '` por nó,
  prefixa `NOT ` em nós de negação. A tabela `opFragments` fica como está — cobre só folhas.
- `src/query-builder/query-builder.ts` — o push de discriminador STI
  (`setConcreteClassDiscriminator` / `setSubClassesDiscriminator`) muda de "anexar ao array plano"
  para "embrulhar a árvore do usuário em `And(userTree, discriminatorLeaf)`".
- Testes — múltiplos layouts de parênteses fixados: OR simples de duas folhas, AND-de-OR,
  OR-de-AND, NOT em volta de um grupo, e a combinação com `inheritance: ONLY` / `SUBCLASSES`.
- [components/query-builder.md](../components/query-builder.md) § Escopo — inverter a linha "Sem
  OR / árvores booleanas aninhadas".
- [concepts/conditions-proxy.md](../concepts/conditions-proxy.md) § Exemplos — adicionar exemplo
  de OR multi-condição, documentar os combinadores ao lado dos métodos por campo.

## Coisas a verificar antes de decidir

- **Demanda concreta de usuário.** A fonte adia isto *"até pelo menos um caso de uso concreto
  aparecer"*. Apareceu? Uma busca em `examples/` e na superfície de consumidores do OOR por
  queries em forma de OR deve preceder a decisão de design.
- **Mapeamento de prior art.** Leitura rápida de `Or` / `Brackets` do TypeORM, `OR` / `AND` /
  `NOT` do Prisma e `or()` / `and()` do Drizzle. O padrão de combinadores (Opção A) é a resposta
  convergente em bibliotecas que começaram com callback tipado; o padrão de objeto (Opção B) é
  convergente em bibliotecas de schema-DSL.
- **Semântica de NOT.** `NOT` é a parte barata sintaticamente, mas a cara para tratamento de
  null: em SQL, `NOT (x = 5)` e `x != 5` diferem quando `x IS NULL`. Expomos `Not` diretamente,
  ou só açúcares como `notIn` / `notEq` (já parcialmente presentes como `ne`)?
- **Atualização do validador.** `UndefinedWhereConditionError` carrega o *índice* no array plano.
  Quando o array representar uma árvore, "índice" precisa de um localizador mais rico (caminho?
  notação de ponto? `[0].children[1]`?). A UX do erro faz parte da API.
- **Checagem de tipos da árvore.** Cada combinador deve preservar `T` de ponta a ponta, para que
  mau uso como `Or(u.email!.eq('a'), o.total!.gt(0))` (misturando proxies de entidades
  diferentes) seja rejeitado em tempo de compilação.

## O que fecharia esta questão

Uma decisão em uma de três direções:

- **"Opção A — combinadores."** Registrar ADR travando a superfície (`Or`, `And`, `Not`), a união
  discriminada `Condition` e a regra de embrulho da árvore STI. Implementar.
- **"Opção B — árvore de objeto."** ADR mais invasivo; precisaria também endereçar como o mapped
  type `Conditions<T>` vira um mapped type `Where<T>` com as mesmas garantias de nome de coluna.
- **"Manter."** Documentar por que uma lista AND plana é suficiente para os casos de uso
  mirados — ou seja, afirmar o adiamento como resposta de longo prazo, não transitória.

## Confiança

**Aberta** — a fonte explicitamente adia; nenhuma decisão registrada. Impacto maior que
[get-one-limit-1](get-one-limit-1.md) / [apply-options-accumulation](apply-options-accumulation.md)
porque a ausência é estrutural, não um ajuste de performance.

## Questões relacionadas

- [apply-options-accumulation](apply-options-accumulation.md) — a questão acumular-vs-substituir
  fica acoplada se a Opção C for considerada. Caso contrário, independente.
