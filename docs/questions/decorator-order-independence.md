# A ordem dos decorators deveria ser independente para `@Column` / `@Nullable`?

> Status: **aberta** · Impacto: **médio** · Esforço: **P**

## Questão

Podemos eliminar a constraint de ordem entre `@Column` / `@PrimaryColumn` e
`@Nullable` / `@NotNullable`, de modo que ambas as ordenações funcionem?

```ts
// Funciona hoje — @Nullable interno (roda primeiro), @Column lê sua entrada.
@Column({ type: COLUMN_TYPE.TEXT })
@Nullable
nickname?: string;

// Lança MissingNullabilityDecoratorError hoje.
@Nullable
@Column({ type: COLUMN_TYPE.TEXT })
nickname?: string;
```

## Por que importa

- **Footgun.** `MissingNullabilityDecoratorError` nomeia a propriedade e o decorator, mas não diz
  ao usuário que *a causa é a ordem em que ele os escreveu*. Contribuidores novos do OOR vão
  bater nisso; os experientes vão bater depois de um refactor.
- **Não reflete diferença significativa.** A intenção do consumidor — "esta coluna é nullable" —
  é a mesma independentemente da linha em que ele escreveu `@Nullable`. A constraint de ordem
  codifica timing de implementação, não intenção do usuário.
- **A ordem de decorators é invisível em PR review.** Um revisor passando os olhos por
  `@Column ... @Nullable` vs. `@Nullable ... @Column` dificilmente nota. O compilador não pega;
  só o runtime, na carga do módulo.

## Comportamento atual (para a questão não decair)

A implementação vive em:

- `src/decorators/nullable/nullable.ts` — declara `NULLABLE_KEY = Symbol('nullable')`.
  `@Nullable` / `@NotNullable` gravam entradas `Map<string, boolean>` chaveadas pelo nome da
  propriedade.
- `src/decorators/column/column.ts` (linhas 31–37) — o `registerColumn` de `@Column` lê
  `NULLABLE_KEY[propertyName]`, lança `MissingNullabilityDecoratorError` se for `undefined` e a
  coluna não for primária, e então embute o campo `nullable` resolvido no `ColumnMetadata`
  empilhado.

O Stage-3 aplica decorators num campo **de baixo para cima** (o decorator interno roda primeiro),
então hoje a ordem que funciona é `@Column` externo, `@Nullable` interno. Ver
[concepts/stage-3-decorators.md](../concepts/stage-3-decorators.md) e
[architecture.md — registro de entidade](../architecture.md#registro-de-entidade).

## Esboço do espaço de design

Três abordagens valem consideração. Nenhuma endossada aqui.

### Opção A — Adiar o join para `@Entity`

`@Column` não lê `NULLABLE_KEY` de jeito nenhum. Empilha um `ColumnMetadata` com
`nullable: undefined` (ou algum sentinela) em `COLUMNS_KEY`. `@Nullable` continua escrevendo em
`NULLABLE_KEY` como hoje.

`@Entity` (que já roda por último) faz o join: para cada entrada em `COLUMNS_KEY`, procura a
entrada correspondente em `NULLABLE_KEY`, preenche `nullable` e lança
`MissingNullabilityDecoratorError` se faltar.

**Prós:** a mais simples. A mensagem de erro passa a poder dizer "faltou `@Nullable`" sem
confundir com ordem. A ordem genuinamente deixa de importar — os dois decorators já escreveram
seu slot quando `@Entity` roda.

**Contras:** o erro é reportado com o contexto da classe (`@Entity` sabe qual classe é, mas
emitir erros por propriedade é ok). A validação se move de "tempo de decoração" para "ainda tempo
de decoração, só um pouco mais tarde" — sem perda semântica real.

### Opção B — Lookup mútuo em tempo de escrita

Ambos os decorators checam o bucket *do outro*. Se `@Column` rodar primeiro, empilha em
`COLUMNS_KEY` com `nullable: undefined`. Quando `@Nullable` roda, se encontrar uma entrada casada
em `COLUMNS_KEY`, a remenda; senão, escreve em `NULLABLE_KEY` como hoje. `@Column`, ao rodar,
similarmente checa `NULLABLE_KEY` primeiro (comportamento atual).

**Prós:** cada decorator se autocorrige, então a ordem funciona nas duas direções.

**Contras:** dois caminhos de escrita por decorator, ambos podendo falhar se um decorator irmão
nunca rodar. Mais superfície de máquina de estados; mais difícil de raciocinar em PR review. O
padrão de "remendo mútuo" é um smell — espalha o invariante por mais código.

### Opção C — `addInitializer` do Stage-3 para adiar

`@Column` e `@Nullable` registram callbacks `addInitializer` que disparam após a construção da
classe. Os callbacks reconciliam os estados dos buckets.

**Prós:** usa o hook de trabalho adiado pretendido pelo Stage-3.

**Contras:** mais pesado. `addInitializer` roda em tempo de instância, não de classe —
granularidade errada para metadados *de classe*. Também move erros de tempo de decoração para
tempo de primeira instância, uma regressão na propriedade "erros em tempo de decoração, não de
primeiro uso".

## Coisas a verificar antes de decidir

- Existem decorators que o OOR planeja adicionar (`@Index`, `@Unique`, `@Default`) que teriam a
  **mesma** forma de coordenação entre irmãos? Se sim, a escolha deveria resolver o caso geral,
  não só `@Column`/`@Nullable`. **A Opção A escala para N irmãos**; a Opção B escala como O(N²)
  caminhos de escrita.
- O que TypeORM / MikroORM / Drizzle fazem com o equivalente (seu padrão de nullable-em-coluna)?
  Uma olhada em prior art pode curto-circuitar a análise.
- A mensagem de erro atual pega isso na prática? Se usuários batem no erro e veem imediatamente o
  que fazer, o custo do footgun é baixo. Se não, é alto.

## O que mudaria no codebase

Se a Opção A for escolhida:

- `column.ts` — remover a leitura de `NULLABLE_KEY` e o lançamento de
  `MissingNullabilityDecoratorError`. Empilhar a coluna com `nullable: undefined`.
- `entity.ts` — adicionar uma passagem de join sobre `COLUMNS_KEY` e `NULLABLE_KEY` antes do
  commit; lançar `MissingNullabilityDecoratorError` daqui em vez disso.
- Testes — adicionar um teste afirmando que `@Nullable @Column ...` (ordem invertida) tem
  sucesso.
- Os avisos de "deve ser interno" em
  [concepts/stage-3-decorators.md](../concepts/stage-3-decorators.md) e
  [architecture.md](../architecture.md#registro-de-entidade) mudam de "deve ser interno" para
  "qualquer ordem funciona".

## Confiança

**Aberta** — sem decisão ainda. Esta página existe para manter a questão descobrível até ser
decidida.

## Questões relacionadas

- [support-user-indexes](support-user-indexes.md) — a resolução escolhida aqui deveria
  restringir como `@Index` lê metadados de irmãos.
