# Stage-3 vs Decorators Legados

> **Veredito.** Stage-3 é o dialeto que o TypeScript trata como default e que a linguagem está
> padronizando. O compromisso do OOR com ele é uma aposta de que a versão sem polyfill, sem
> `Reflect` e alinhada à toolchain de ORMs baseados em decorators é a que vale construir. A
> contribuição é chegar cedo do lado certo dessa transição, com um design que não depende das
> affordances legadas.

## Por que isso importa para o OOR

Decorators são o mecanismo fundacional sobre o qual um ORM baseado em decorators é construído. A
escolha de dialeto não é preferência estilística — ela determina os requisitos de runtime que o
OOR impõe aos consumidores, a forma do armazenamento de metadados, as premissas de toolchain e a
qual trajetória do TC39 a biblioteca está alinhada.

O compromisso do OOR com decorators ECMAScript Stage-3
([ADR 0001](../decisions/0001-stage-3-decorators.md)) é a decisão fundacional sobre a qual o
resto da arquitetura repousa. Esta página é o caso longo de por que essa aposta é a certa para
um ORM de 2026 em diante.

> **Uma sintaxe, dois dialetos, uma trajetória.** Os dois dialetos de decorators usam a mesma
> sintaxe-fonte `@decorator`. A diferença está em *assinaturas* e *requisitos de runtime*. A
> trajetória da linguagem é a do Stage-3; decorators legados são específicos do TypeScript e
> nunca foram padronizados. Escolher o legado em 2026 é escolher a trilha de deprecação para um
> mecanismo fundacional.

## Comparação

| Dimensão | Decorators legados | Decorators Stage-3 (escolha do OOR) |
| --- | --- | --- |
| **Padronização** | Nunca padronizado. Extensão específica do TypeScript atrás de `experimentalDecorators`. Diverge da trajetória da proposta TC39. | TC39 **Stage 3** (decorator metadata aceito em março de 2023). No pipeline de padronização; o dialeto que os runtimes eventualmente entregarão nativamente. |
| **Flag do TypeScript** | Exige `experimentalDecorators: true` (e geralmente `emitDecoratorMetadata: true`). | Nativo desde o TypeScript 5.0 (março de 2023). Ativo quando `experimentalDecorators` está **desligado**. O `tsc --init` faz default para Stage-3 (a flag legada fica comentada). |
| **Assinatura de decorator de classe** | `(target: Function) => void \| Function` — recebe a classe nua. | `<T extends new (...a: any) => any>(value: T, context: ClassDecoratorContext<T>) => T \| void` — recebe a classe e um `context` estruturado. |
| **Assinatura de decorator de campo** | `(target: Object, propertyKey: string \| symbol) => void` | `(value: undefined, context: ClassFieldDecoratorContext) => ((initial: T) => T) \| void` |
| **Assinatura de decorator de método** | `(target: Object, key: string \| symbol, desc: PropertyDescriptor) => PropertyDescriptor \| void` | `(value: Function, context: ClassMethodDecoratorContext) => Function \| void` |
| **Objeto de contexto** | Nenhum — recebe `target` e `key` crus. Estado de side-channel vive em `Reflect.metadata` ou mapas externos. | `context` de primeira classe: `{ kind, name, static, private, access, addInitializer, metadata }`. Substituição na própria linguagem para o registro `Reflect`. |
| **Requisito de `reflect-metadata`** | Universal na prática. Bibliotecas (TypeORM, DI do NestJS, Inversify) leem `design:type` / `design:paramtypes` via `Reflect.getMetadata`. Exige `import "reflect-metadata"` no entry point do processo. | Nenhum. `context.metadata` é da linguagem. Sem registro global, sem polyfill, sem import no entry point. |
| **Isolamento de metadados da biblioteca** | Compartilha o registro global `Reflect` com o que mais a aplicação hospedeira usar de `Reflect.metadata`. | Pertencente à biblioteca. O [MetadataStorage](../components/metadata-storage.md) do OOR é um `Map<Constructor, EntityMetadata>` que pode mudar de forma sem colidir com nada. |
| **Palavra-chave `accessor`** | Sem equivalente. | Primeira classe. `accessor x: string;` desacucara para um campo privado mais getter/setter automáticos, que decorators podem envolver via `{ get, set, init }`. |
| **Hook `addInitializer`** | Sem equivalente — decorators precisam alcançar o construtor manualmente. | Primeira classe. `context.addInitializer(fn)` agenda `fn` na construção da instância. Separação limpa entre trabalho de avaliação de classe e trabalho por instância. |

## O que o OOR ganha ao se comprometer com Stage-3

### Alinhamento com a trilha de padronização

Decorators legados são uma extensão específica do TypeScript que saiu antes de a proposta TC39
estabilizar. Nunca serão padronizados como são — a proposta que *estabilizou* (Stage 3) tem
assinaturas incompatíveis. Escolher o legado agora é escolher uma trilha que cada vez mais vai
parecer um artefato transicional.

Stage-3 está no pipeline de padronização. Avançar para Stage 4 em 2026 ou 2027 não muda a
trajetória: é o dialeto que os runtimes eventualmente entregarão nativamente, e o dialeto que o
TypeScript trata como default.

### Runtime sem polyfill

Decorators legados na prática exigem `import "reflect-metadata"` no topo do entry point de toda
aplicação consumidora. É um custo real: uma dependência transitiva, um polyfill que patcheia um
global, mais uma coisa que precisa carregar antes de qualquer módulo decorado ser avaliado. Num
processo com múltiplas bibliotecas que usam decorators, todas escrevem no mesmo registro global
`Reflect`.

O OOR sai sem `reflect-metadata`. Consumidores não precisam de polyfill, não precisam lembrar de
importá-lo no entry point do processo e não arriscam colisões de registro com outras bibliotecas.

### Metadados pertencentes à biblioteca

O `Reflect.metadata` do dialeto legado é um registro global. Qualquer biblioteca pode escrever
nele; bibliotecas que compartilham a mesma chave colidem. O `context.metadata` do Stage-3 é da
biblioteca.

O [MetadataStorage](../components/metadata-storage.md) do OOR é um
`Map<Constructor, EntityMetadata>` por instância de `Database`. A forma do storage pode evoluir —
campos novos, símbolos novos, passagens de join novas — sem colidir com o que mais usar
`Reflect.metadata` na aplicação de um consumidor. A biblioteca tem controle total sobre o layout
dos seus metadados.

### Alinhamento de toolchain

Bun, Deno e toolchains modernas de Node favorecem a trilha de padronização. `tsc --init` faz
default para Stage-3. Escolher o legado em 2026 é nadar contra a corrente dos defaults de
configuração da própria linguagem.

O OOR ser Bun-only ([ADR 0007](../decisions/0007-bun-toolchain.md)) compõe isso — o frontend
TypeScript do Bun transpila decorators Stage-3 nativamente, e o `tsconfig` do projeto não está
atulhado de flags transicionais. A história de toolchain é "TypeScript moderno baunilha", não
"TypeScript com as flags legadas ligadas".

### Novas affordances

Stage-3 introduz duas affordances para as quais decorators legados não têm equivalente:

- **Palavra-chave `accessor`.** Permite a um campo ser envolvido com getter/setter auto-gerados,
  interceptados pelo trio `{ get, set, init }` de um decorator. Útil para change tracking,
  propriedades computadas e inicialização lazy.
- **Hook `addInitializer`.** Agenda trabalho na construção da instância, limpamente separado do
  trabalho de avaliação de classe. Útil para inicialização em nível de instância que a declaração
  de classe não deveria rodar.

O OOR não usa nenhuma hoje, mas são ferramentas disponíveis se o design evoluir para precisar
delas. Decorators legados não oferecem caminho de crescimento equivalente.

## O que o OOR aceita como custo

O dialeto Stage-3 não carrega duas affordances pelas quais o dialeto legado era famoso. Ambas são
deliberadamente aceitas no design do OOR em vez de contornadas.

### Tipos de coluna explícitos em vez de inferência via `design:type`

Com `emitDecoratorMetadata: true`, o dialeto legado deixa uma biblioteca ler o tipo TypeScript de
uma propriedade decorada em runtime via
`Reflect.getMetadata("design:type", target, key)`. O TypeORM usa isso para escrever `@Column()`
sem argumento de tipo:

```ts
@Column() // tipo inferido de `string` via design:type
firstName: string;
```

Stage-3 **não** emite `design:type`. O OOR paga esse custo: tipos de coluna são explícitos.

```ts
@Column({ type: COLUMN_TYPE.TEXT })
firstName!: string;
```

O custo é limitado. O enum [`COLUMN_TYPE`](../components/sql-types.md) é fechado (47 tipos PG) e
serve de documentação no call site. Também expõe um desencontro de impedância real entre
TypeScript e PostgreSQL que a inferência mascara: `string` poderia ser `TEXT`, `VARCHAR(n)`,
`CHAR(n)`, `JSONB` stringificado ou `BYTEA` em base64. Forçar o usuário a escolher é mais honesto
que adivinhar.

### Sem auto-wiring de DI por parâmetro de construtor

O dialeto legado tem decorators de parâmetro (`@Inject(Foo) private foo: Foo`) e informação de
tipos de runtime `design:paramtypes`, que juntos permitem a containers de DI estilo NestJS fazer
auto-wire de construtores. Stage-3 não tem nenhum dos dois (decorators de parâmetro são uma
sub-proposta separada que não avançou).

O [container de DI](../concepts/di-container.md) planejado do OOR
([ADR 0003](../decisions/0003-singleton-di-container.md)) é *mínimo* — registro singleton via
chamadas explícitas, não auto-wiring de parâmetros de construtor. A escolha de design de DI é a
jusante da escolha de dialeto: o OOR não precisa de decorators de parâmetro, então a lacuna não
se aplica. Para um ORM, é o escopo certo.

## Por que a aposta do OOR compensa

As grandes bibliotecas do ecossistema JS que usam decorators (TypeORM, NestJS, Inversify) estão
presas em decorators legados porque fizeram compromissos arquiteturais que dependem de
`design:paramtypes` para auto-wiring de DI por parâmetro de construtor. Migrar essas bibliotecas
para Stage-3 não é mudança cosmética — é um redesign do mecanismo central delas. O custo de
migração é substancial o suficiente para que nenhuma tenha anunciado um plano público.

O OOR não tem esse lock-in. A biblioteca foi desenhada desde o primeiro dia para não precisar de
decorators de parâmetro, e o armazenamento de metadados é um `Map` próprio, não um registro
`Reflect`. O caminho Stage-3 que é caro para um codebase de 7 anos é o default barato para uma
biblioteca clean-room — e é o caminho em que a linguagem está.

Para um TCC, esta é a versão mais forte de "lugar certo, hora certa": o dialeto para o qual o
ecossistema eventualmente terá de migrar é o dialeto que uma biblioteca nova pode adotar a custo
zero. O compromisso do OOR é uma aposta de que a versão sem polyfill, sem `Reflect` e alinhada à
toolchain de ORMs baseados em decorators é a que vale construir — e a aposta é estruturalmente
favorável.

## Fontes

- TC39 proposal-decorators: <https://github.com/tc39/proposal-decorators>
- Anúncio do TypeScript 5.0: <https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#decorators>
- `experimentalDecorators` na documentação de tsconfig: <https://www.typescriptlang.org/tsconfig#experimentalDecorators>
- `reflect-metadata`: <https://github.com/rbuckton/reflect-metadata>
- Babel plugin-proposal-decorators: <https://github.com/babel/babel/tree/main/packages/babel-plugin-proposal-decorators>
- Runtime TypeScript do Bun: <https://bun.sh/docs/runtime/typescript>
- OOR: [ADR 0001](../decisions/0001-stage-3-decorators.md),
  [concepts/stage-3-decorators.md](../concepts/stage-3-decorators.md),
  [components/metadata-storage.md](../components/metadata-storage.md)
