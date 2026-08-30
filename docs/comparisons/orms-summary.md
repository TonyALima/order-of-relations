# ORMs — matriz resumo

Uma matriz única de features das contribuições do OOR contra os três ORMs TypeScript dominantes.
Para a tese longa por trás de cada linha, ver [oor-vs-typeorm](oor-vs-typeorm.md),
[oor-vs-drizzle](oor-vs-drizzle.md), [oor-vs-prisma](oor-vs-prisma.md) e
[stage-3-vs-legacy-decorators](stage-3-vs-legacy-decorators.md).

> **Veredito.** O padrão: o OOR empata com o TypeORM no perfil ergonômico OO (Repository, builder
> lazy, STI nativa) enquanto empata com Drizzle/Prisma nas garantias modernas (sem polyfill,
> tipos estritos) — e adiciona as contribuições que nenhum dos dois lados entrega (sem escotilha
> `unsafe` de SQL, proxy de predicados sem helpers importados, regras de tipos específicas de PG
> no nível de tipos).

## Legenda

| Símbolo | Significado |
| --- | --- |
| ✅ | Entregue |
| ⏳ | Planejado e bem circunscrito (página de questão em aberto com eixos explicitados, superfície de decorator definida, superfície de mudança descrita). Tratado como valor equivalente pela [convenção de comparações](README.md). |
| 🟡 | Parcial — coberto em alguns casos, mas não como propriedade deliberada de primeira classe |
| ❌ | Não entregue |
| — | Não aplicável (o concorrente usa um mecanismo fundamentalmente diferente, então a pergunta não se traduz) |

## A matriz

| Feature | OOR | TypeORM | Prisma | Drizzle |
| --- | :-: | :-: | :-: | :-: |
| **Fundação** | | | | |
| Dialeto moderno de decorators (ECMAScript Stage-3) | ✅ | ❌ | — | — |
| TypeScript como fonte única da verdade (sem DSL de schema separada) | ✅ | ✅ | ❌ | ✅ |
| Sem etapa de codegen no loop de desenvolvimento | ✅ | ✅ | ❌ | ✅ |
| Classe-como-schema (a entidade é o tipo e pode carregar métodos) | ✅ | ✅ | ❌ | ❌ |
| **Forma da API** | | | | |
| `Repository<T>` por entidade como ponto de entrada único | ✅ | 🟡 | ❌ | ❌ |
| `QueryBuilder<T>` lazy encadeável | ✅ | ✅ | ❌ | ✅ |
| Queries parcialmente montadas componíveis (valor tipado, refinável entre funções) | ✅ | ✅ | ❌ | ✅ |
| Um modelo mental — sem caminhos paralelos simples-vs-composto | ✅ | ❌ | ✅ | ❌ |
| `where()` sem strings SQL | ✅ | ❌ | ✅ | ✅ |
| Constraint de operador por coluna (lado direito tipado contra o tipo da coluna) | ✅ | ❌ | ✅ | ✅ |
| **Segurança de SQL** | | | | |
| **Sem** strings SQL cruas nem nos internals da biblioteca | ✅ | ❌ | ❌ | ❌ |
| Rejeição em tempo de compilação de entidades parciais no `create()` | ✅ | ❌ | ✅ | ✅ |
| **Modelagem** | | | | |
| Single-Table Inheritance nativa com coluna discriminadora | ✅ | ✅ | ❌ | ❌ |
| Affordances específicos de PostgreSQL como tipos de primeira classe | ✅ | ❌ | ❌ | 🟡 |
| **Toolchain** | | | | |
| Suporte nativo a Bun | ✅ | ❌ | 🟡 | ✅ |

## Notas sobre células selecionadas

Algumas células precisam de esclarecimento — a matriz é compacta por design, mas algumas linhas
escondem nuance significativa.

### `Repository<T>` por entidade (TypeORM 🟡)

O TypeORM tem uma classe `Repository<T>`, então a feature literal está presente. O 🟡 reflete que
ela *não* é o ponto de entrada único — `DataSource`, `EntityManager` e `Repository<T>` coexistem,
e `Repository.find()` (executa imediatamente) tem forma diferente de
`Repository.createQueryBuilder()` (lazy). A propriedade "ponto de entrada único por entidade com
fronteira unidirecional simples-vs-composto" a que a
[ADR 0002](../decisions/0002-repository-with-lazy-query-builder.md) se compromete é específica do
OOR.

### Um modelo mental (Prisma ✅)

O Prisma marca ✅ aqui porque *existe* uma forma só: `prisma.<modelName>.<verb>({ ... })`. Não há
caminhos paralelos simples-vs-compostos porque não há caminho composto algum (queries são
literais de objeto, não builders encadeáveis). É um jeito diferente de satisfazer a mesma
propriedade, não o mesmo jeito.

### API de predicado como proxy namespacado por coluna (Prisma 🟡)

O `where: { email: { contains: "..." } }` do Prisma lê como um literal de objeto de predicado
namespacado por coluna — o operador (`contains`) vive sob a chave da coluna (`email`). É
estruturalmente similar ao proxy `cb.email.eq(value)` do OOR, mas falta a affordance de
autocomplete `cb.<tab>` e a composição encadeável.

### Constraint de operador por coluna (TypeORM ❌)

O `where("user.email = :email", { email })` do TypeORM é um fragmento SQL com parâmetros
nomeados. O lado direito da igualdade é bound em runtime, não constrangido em tempo de compilação
contra o tipo da coluna. Constraint por coluna exige que o predicado seja uma expressão tipada,
não uma string.

### Política estrita de no-`any` (Prisma / Drizzle 🟡)

Ambos entregam APIs públicas tipadas na prática — cliente gerado (Prisma) ou tipos inferidos
(Drizzle). Nenhum documenta uma postura `@typescript-eslint/no-explicit-any` em nível de projeto
como a [ADR 0005](../decisions/0005-no-any-type-driven-api.md) faz para o OOR. O 🟡 reflete
"estrito na prática, não afirmado como garantia dura".

### Rebaixamento de FK (Drizzle 🟡)

Os tipos de coluna do Drizzle incluem `serial()` e `integer()` como primeira classe, e o usuário
pode escrever uma referência de FK manual usando o tipo certo. O 🟡 reflete que o rebaixamento é
*manual* — o usuário escolhe o tipo da coluna FK. O OOR o deriva da PK referenciada no nível de
tipos ([components/sql-types.md](../components/sql-types.md)), então um refactor da PK
referenciada propaga para os tipos das colunas FK automaticamente.

### Affordances de PostgreSQL como tipos de primeira classe (Drizzle 🟡)

O `pgTable` do Drizzle expõe tipos de coluna e features de índice específicos de PG
ricamente. O 🟡 reflete que a arquitetura multi-dialeto torna os schemas específicos por dialeto
(`pgTable` ≠ `mysqlTable`); os affordances de PG são de primeira classe *dentro* do schema PG,
mas o sistema de tipos mais amplo precisa modelar a superfície cross-dialeto.

### Suporte a Bun (Prisma 🟡)

Uso comunitário funciona. Não há afirmação autoritativa "Bun é suportado" na documentação atual
do Prisma. O 🟡 reflete "funciona na prática, não é um alvo documentado".

## Como ler esta matriz

Uma linha é **contribuição do OOR** quando a célula do OOR é `✅` (ou `⏳`) e pelo menos uma
célula de concorrente não é. Alguns padrões:

- **Linhas onde OOR ✅ e todos os concorrentes ✅** (SQL parametrizado por default, builder lazy
  encadeável etc.) — piso em que o campo convergiu. O OOR não perde nada por estar do lado
  moderno dessas.
- **Linhas onde OOR ✅ e TypeORM ✅ mas Prisma/Drizzle ❌** (ponto de entrada Repository, STI
  nativa, classe-como-schema) — o perfil ergonômico OO que o OOR mantém e moderniza
  ([oor-vs-drizzle](oor-vs-drizzle.md), [oor-vs-prisma](oor-vs-prisma.md)).
- **Linhas onde OOR ✅ e TypeORM ❌ mas Prisma/Drizzle ✅** (sem `reflect-metadata`, metadados
  pertencentes à biblioteca, no-`any` estrito) — o perfil de garantias modernas que o OOR adota e
  do qual o TypeORM está trancado para fora
  ([oor-vs-typeorm](oor-vs-typeorm.md), [stage-3-vs-legacy-decorators](stage-3-vs-legacy-decorators.md)).
- **Linhas onde OOR ✅ e os três concorrentes ❌** — as contribuições distintivas do OOR:
  - Sem escotilha `unsafe` de SQL na API pública
  - Sem strings SQL cruas nem nos internals da biblioteca
  - Índice auto-emitido na coluna discriminadora de STI
  - Rebaixamento de FK no nível de tipos (SERIAL → INTEGER)
  - Rejeição em tempo de compilação de entidades parciais no `create()` (contra o TypeORM)

Esse último balde é a resposta a "o que o OOR traz que o campo ainda não tinha?". Os outros
baldes são a resposta a "o que o OOR mantém que o campo vem dividindo em dois?"

## Fontes

- Documentação do TypeORM: <https://typeorm.io>
- Documentação do Prisma: <https://www.prisma.io/docs>
- Documentação do Drizzle: <https://orm.drizzle.team>
- TC39 proposal-decorators: <https://github.com/tc39/proposal-decorators>
- ADRs do OOR: [0001](../decisions/0001-stage-3-decorators.md),
  [0002](../decisions/0002-repository-with-lazy-query-builder.md),
  [0004](../decisions/0004-parameterized-sql-only.md),
  [0005](../decisions/0005-no-any-type-driven-api.md),
  [0006](../decisions/0006-tdd-rhythm.md),
  [0007](../decisions/0007-bun-toolchain.md)
