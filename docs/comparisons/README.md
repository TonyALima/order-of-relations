# Comparisons

Análises lado a lado redigidas como material de defesa do TCC. Cada página responde: *o que o
OOR contribui que o campo ainda não tinha, e por que importa?*

> **Isto não é guia de decisão para consumidores.** As comparações desta pasta são escritas do
> ponto de vista do OOR, defendendo a contribuição. Não são árvores de "devo escolher OOR ou X?"
> e não incluem seções de "quando usar qual" ou "onde o OOR está atrás". Comparações de maturidade
> de projeto também estão fora de escopo — um TCC contra um projeto estabelecido de anos é
> estruturalmente sem sentido nesse eixo.

## Páginas

### Matriz resumo

- [orms-summary.md](orms-summary.md) — matriz única de features das contribuições do OOR contra
  os três concorrentes. O placar rápido; com links para as páginas longas por trás de cada linha.

### ORM vs ORM

- [oor-vs-typeorm.md](oor-vs-typeorm.md) — ergonomia no formato do TypeORM com garantias
  modernas. A contribuição é remover as constraints (decorators legados, `reflect-metadata`,
  fragmentos de SQL cru, `any` na costura de parâmetros) que o TypeORM acumulou por ter sido o
  default pioneiro.
- [oor-vs-drizzle.md](oor-vs-drizzle.md) — o perfil ergonômico OO, modernizado. O Drizzle dobra
  o sistema de tipos para caber no SQL; o OOR mantém classe-como-schema, ponto-de-entrada-único
  por entidade e polimorfismo nativo — o caminho de que o Drizzle deliberadamente abriu mão.
- [oor-vs-prisma.md](oor-vs-prisma.md) — o próprio TypeScript como schema. A contribuição é
  explorar o caminho que o design do Prisma fechou: schema-como-código (sem DSL, sem codegen, sem
  artefatos gerados) com um builder fluente componível sobre entidades declaradas como classes.

### Dialeto de decorators

- [stage-3-vs-legacy-decorators.md](stage-3-vs-legacy-decorators.md) — a escolha de dialeto
  fundacional sobre a qual o OOR repousa. Stage-3 é o dialeto em via de padronização, sem
  polyfill, alinhado à toolchain; o legado é onde as grandes bibliotecas que usam decorators
  estão presas por lock-in arquitetural. A aposta do OOR é chegar cedo do lado certo dessa
  transição.

## Convenção

Toda página desta pasta segue o mesmo esqueleto:

1. **Veredito** — conclusão de uma linha, lida como alegação de contribuição, não como ajuda de
   decisão hedged.
2. **`## O que o OOR traz de novo`** — bullets no topo, 3–5 alegações de contribuição.
3. **`## Visão geral`** — que pergunta esta comparação responde sobre o lugar do OOR no campo.
4. **`## Comparação`** — tabela de dimensões, ~10 linhas. Features planejadas e bem
   circunscritas contam como valor equivalente (com link para a questão em aberto).
5. **`## A contribuição do OOR, dimensão por dimensão`** — prosa longa, uma subseção por eixo
   importante.
6. **`## Por que o OOR importa num mercado cheio`** — argumento de fechamento; a defesa do TCC
   numa seção.
7. **`## Fontes`** — URLs de documentação upstream, links para ADRs.
