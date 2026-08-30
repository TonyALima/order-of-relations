# ECMAScript Stage-3 Decorators

## Definição

A proposta de **decorators TC39 Stage-3** é a sucessora padronizada do `experimentalDecorators`
legado do TypeScript. Stage-3 significa que a proposta está finalizada no texto da spec e
implementada em engines em produção, à frente do merge na linguagem no Stage 4. Um decorator é
uma função aplicada com a sintaxe `@decorator` a classes, métodos, accessors, campos e
auto-accessors de classe, recebendo um valor alvo e um objeto `context` que descreve o binding.

## Como funciona

A assinatura de um decorator Stage-3 é `(value, context) => replacement`. O argumento `context`
carrega:

- `kind` — `"class" | "method" | "field" | ...`
- `name` — o nome da propriedade (ou `undefined` para a própria classe)
- `static` — se o binding está no construtor
- `private` — se o binding é `#private`
- `addInitializer(fn)` — agenda um callback para quando a classe for inicializada
- `access` — helpers de getter/setter

Isso difere radicalmente da forma legada, que recebia `(target, propertyKey, descriptor)` e
dependia de `Reflect.defineMetadata` para passar metadados entre decorators.

No OOR, a ausência de `Reflect.metadata` é preenchida por:

1. **`context.metadata`** — o bag de metadados por-classe do Stage-3, usado como *buffer de
   escrita*. Decorators de campo empilham nele sob **três** chaves-símbolo privadas, cada uma com
   uma forma:

   ```ts
   const COLUMNS_KEY   = Symbol('columns');    // ColumnMetadata[]
   const RELATIONS_KEY = Symbol('relations');  // RelationMetadata[]
   const NULLABLE_KEY  = Symbol('nullable');   // Map<string, boolean>
   ```

   `@Column` / `@PrimaryColumn` empilham em `COLUMNS_KEY`. `@ToOne` empilha em `RELATIONS_KEY`.
   `@Nullable` e `@NotNullable` gravam entradas no mapa `NULLABLE_KEY` (nome da propriedade →
   `true` / `false`). O bucket `NULLABLE_KEY` é um **canal par-a-par entre decorators irmãos**:
   `@Column` o lê em tempo de registro, mas `@Entity` não.
2. **Um `Map<Constructor, EntityMetadata>` pertencente a uma instância de
   [Database](../components/database.md)** — o armazenamento durável. O decorator de classe
   `@Entity(db)` roda *depois* de todos os decorators de campo (pela spec da linguagem), puxa
   `COLUMNS_KEY` e `RELATIONS_KEY` de `context.metadata`, valida que ao menos uma coluna é
   `primary` (senão lança `MissingPrimaryColumnError`) e despeja um `EntityMetadata` finalizado
   em `db.getMetadata()`. `NULLABLE_KEY` já foi consumido pelos decorators de campo a essa
   altura; ele não chega ao storage.

O bag `context.metadata` é **novo por classe** — Stage-3 não o propaga através de declarações de
subclasse. A herança é reconstruída em tempo de resolução do storage, caminhando pela cadeia de
protótipos (ver [single-table-inheritance.md](single-table-inheritance.md)).

> **A ordem dos decorators importa: `@Nullable` deve ser o interno.** Decorators Stage-3 são
> aplicados **de baixo para cima** num campo — o decorator mais próximo da propriedade roda
> primeiro. Como `@Column` lê `NULLABLE_KEY` e lança `MissingNullabilityDecoratorError` se a
> entrada da propriedade faltar, `@Nullable` (ou `@NotNullable`) precisa popular o bucket *antes*
> de `@Column` rodar.
>
> ```ts
> // ✅ Funciona — @Nullable é interno (roda primeiro), depois @Column lê sua entrada.
> @Column({ type: COLUMN_TYPE.TEXT })
> @Nullable
> nickname?: string;
>
> // ❌ Lança MissingNullabilityDecoratorError — @Column é interno (roda primeiro),
> //    NULLABLE_KEY ainda não tem entrada para `nickname`.
> @Nullable
> @Column({ type: COLUMN_TYPE.TEXT })
> nickname?: string;
> ```
>
> `@PrimaryColumn` é isento: força `nullable: false` e pula a consulta a `NULLABLE_KEY`
> inteiramente.
>
> **Questão em aberto:** [decorator-order-independence](../questions/decorator-order-independence.md)
> — redesenhar para que ambas as ordens funcionem.

## O padrão constraint-flip (somente leitura)

Decorators Stage-3 **não conseguem injetar informação de tipo** num campo — só conseguem LER o
tipo declarado do campo via a constraint de `ClassFieldDecoratorContext<This, Value>`. O OOR
explora isso *estreitando* `Value` nos overloads dos decorators para rejeitar declarações
incompatíveis no call site:

- `@Nullable` exige `NullableField<V>` → o campo deve ser declarado com o modificador `?`.
- `@NotNullable` exige `NotNullableField<V>` → o campo deve ser declarado com o modificador `!`.
- `@PrimaryColumn` (com autogeração) exige `NullableField<V> & NullablePrimaryKey<V>` → o campo
  deve ser opcional **e** carregar o [brand `PrimaryKey<V>`](primary-key-brand.md).
- `@PrimaryColumn` (sem autogeração) exige `NotNullableField<V> & PrimaryKey<V>` → o campo deve
  ser obrigatório **e** ter brand.

Este é o único mecanismo estrutural de enforcement em tempo de compilação disponível no dialeto.
É por isso que o brand tem de viver no site de declaração (um decorator não consegue adicioná-lo
por você), e é por isso que o modificador (`?` vs `!`) do campo tem de casar com a opção
`autogeneration` do `@PrimaryColumn` — ambas as verificações acontecem na mesma chamada de
decorator.

## Por que importa

Para o OOR especificamente:

- É a escolha à prova de futuro — sem migração no horizonte quando o TC39 avançar a proposta.
- Elimina a dependência do polyfill `reflect-metadata` para consumidores do pacote npm publicado.
- A biblioteca é dona do próprio layout de metadados; o comportamento não depende de estado
  global de `Reflect` compartilhado com o que mais estiver no bundle do consumidor.

Para o ecossistema em geral: encerra uma cisão de anos em que os decorators do TypeScript não
eram JavaScript padrão. Quando Stage-3 virar Stage-4, `experimentalDecorators` passa a ser a
variante legada.

## Exemplos

```ts
// Decorator de classe Stage-3
function Entity(value: new (...args: unknown[]) => unknown, context: ClassDecoratorContext) {
  metadataStorage.tables.set(value, { name: context.name ?? '' });
  return value;
}

@Entity
class User {
  /* ... */
}
```

Compare com a forma legada:

```ts
// Legado — NÃO usado no OOR
function Entity(target: Function) {
  Reflect.defineMetadata('entity', true, target);
}
```

## Conexões

- [ADR 0001](../decisions/0001-stage-3-decorators.md) — a decisão que fixa esta escolha.
- [MetadataStorage](../components/metadata-storage.md) — o `Map` por-`Database` que substitui
  `Reflect.metadata`.
- [comparisons/stage-3-vs-legacy-decorators.md](../comparisons/stage-3-vs-legacy-decorators.md) —
  a comparação detalhada entre os dialetos.
