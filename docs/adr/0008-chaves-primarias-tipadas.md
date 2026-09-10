# ADR-0008: Chaves primárias tipadas com `PrimaryKey`

## Status

Accepted

## Contexto

As operações do `Repository` que identificam uma linha precisam de todos os
campos da chave primária. Uma API que aceita qualquer subconjunto da entidade
permite erros de chamada; em particular, uma chave autogerada declarada como
opcional pode deixar uma atualização sem chave e resultar em uma operação sem
linhas afetadas.

Os decoradores ECMAScript Stage 3 registram quais campos são primários somente
nos metadados de execução. Eles podem restringir uma declaração de campo, mas
não podem acrescentar informação ao seu tipo TypeScript. Portanto, não podem
inferir automaticamente, para os genéricos de `Repository<T>`, quais campos de
`T` são chaves primárias.

## Decisão

Cada campo anotado com `@PrimaryColumn` deve ser declarado com a marca
`PrimaryKey<V>`. A marca é uma interseção de tipos com um `unique symbol` e é
apagada em tempo de execução:

```ts
type PrimaryKey<V> = V & { readonly [__pkBrand]: true };
```

Uma chave comum é declarada como `id!: PrimaryKey<number>`. Quando o valor é
gerado pelo cliente ou pelo banco, a declaração é
`id?: PrimaryKey<number>`. Os overloads de `@PrimaryColumn` exigem tanto a
marca quanto a opcionalidade compatível com a configuração de autogeração.

Os tipos derivados usam a marca para localizar as propriedades da chave.
`PKInput<T>` torna todos esses campos obrigatórios, não indefinidos e sem a
marca; `PKOutput<T>` tem os mesmos campos obrigatórios e preserva a marca.
`UnbrandedT<T>` remove a marca de cada propriedade para os valores de entrada.

As assinaturas vigentes são:

```ts
findById(key: PKInput<T>): Promise<T | null>;
create(entity: UnbrandedT<T>): Promise<PKOutput<T>>;
delete(key: PKInput<T>): Promise<void>;
update(entity: Partial<UnbrandedT<T>> & PKInput<T>): Promise<void>;
```

`findMany` e `findOne` não recebem uma forma de entidade e permanecem fora
desse contrato. A validação de execução para uma chave incompleta permanece
como defesa para chamadas que contornem o TypeScript com casts.

O material histórico usa o nome `CreateInput<T>`, mas esse tipo não existe na
implementação atual. O contrato de criação vigente é `UnbrandedT<T>`; o ADR
não apresenta `CreateInput<T>` como uma API disponível.

## Consequências

- Para uma chave simples, `repository.findById({ id: 1 })` e
  `repository.delete({ id: 1 })` aceitam o número comum, mas rejeitam objetos
  sem `id` durante a verificação de tipos.
- Para uma chave composta, cada componente é exigido. Por exemplo,
  `findById({ orderId: 1, productId: 2 })` é válido, enquanto omitir
  `productId` não é.
- Para uma chave autogerada, `create({ name: 'Ana' })` pode omitir a chave e
  retorna uma `PKOutput<T>` completa. Já `update` continua exigindo a chave,
  mesmo que a propriedade seja opcional na entidade.
- Valores retornados preservam a marca e são aceitos em entradas sem marca;
  assim, buscar e atualizar a mesma entidade não exige casts.
- `PrimaryKey<V>` é público e é exportado por `src/index.ts`, pois é necessário
  para declarar entidades. `PKInput<T>`, `PKOutput<T>`, `UnbrandedT<T>` e
  `Unbrand<V>` são detalhes internos: não são exportados pelo barril público e
  os exemplos não os importam diretamente.

## Alternativas consideradas

- Informar as chaves em um segundo genérico, como
  `Repository<User, 'id'>`: rejeitado porque duplica a fonte de verdade e o
  tipo não consegue assegurar que esse genérico coincide com
  `@PrimaryColumn`.
- Validar apenas em tempo de execução: rejeitado porque mantém chamadas
  incorretas compiláveis e não evita a atualização sem chave antes da execução.
- Fazer o decorador inserir a marca automaticamente: inviável com decoradores
  Stage 3, que não alteram o tipo declarado do campo.

## Referências

- [Arquitetura: Repository](../architecture.md#repository)
- [Convenção dos ADRs](README.md)
