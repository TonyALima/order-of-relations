# Documentação no código

Este documento define como registrar informações que precisam permanecer próximas ao código. Ele complementa o `README.md` e os documentos de `docs/`; não os substitui.

## Princípio

Documente intenção, contexto, contratos e decisões. Não descreva instruções que o código já torna evidentes. Prefira nomes claros, tipos precisos e funções pequenas antes de adicionar um comentário.

Use documentação quando ela responder a uma pergunta que não pode ser respondida apenas pela leitura da assinatura e da implementação, por exemplo:

- um contrato público, uma pré-condição ou uma pós-condição relevante;
- uma regra de negócio, invariante ou efeito colateral;
- uma exceção que o consumidor precisa tratar;
- uma decisão não óbvia, limitação conhecida ou integração externa;
- um motivo temporário para trabalho pendente.

Evite comentários que repitam o código, expliquem detalhes locais autoexplicativos, narrem histórico que pertence ao Git ou apenas escondam uma implementação difícil de entender. Nesses casos, melhore o código ou registre a decisão na documentação apropriada.

Inadequado:

```ts
// Incrementa o contador.
counter++;
```

Adequado:

```ts
// A API externa aceita no máximo 100 registros por requisição.
const batchSize = 100;
```

## APIs públicas

Use TSDoc, no formato `/** ... */`, para exports que tenham contrato, comportamento ou restrições que não sejam óbvios pelo nome e pelos tipos. A primeira frase deve resumir o propósito; os parágrafos seguintes devem registrar somente o que o consumidor precisa saber.

Documente classes e interfaces públicas quando o papel, o ciclo de vida ou as responsabilidades não estiverem claros pela declaração. Documente métodos e funções públicas quando houver condições de erro, efeitos no banco, mutação, ordenação, paginação, relação com transações ou outro contrato observável.

Use as tags abaixo apenas quando acrescentarem informação útil:

- `@param` para parâmetros cujo significado, formato ou restrição não seja autoexplicativo;
- `@returns` para resultado com semântica além do tipo;
- `@throws` para erros relevantes que o consumidor deve tratar;
- `@example` para o uso de uma API que não seja evidente.

```ts
/**
 * Persiste a entidade e retorna sua chave primária.
 *
 * A operação participa da transação ativa quando houver uma.
 *
 * @throws {IncompletePrimaryKeyError} Quando uma chave primária composta estiver incompleta.
 */
async create(entity: UnbrandedT<T>): Promise<PKOutput<T>> {
  // ...
}
```

Não duplique tipos em texto. Se `id: number` já comunica o requisito, `@param id O identificador numérico` não acrescenta informação.

## Contratos e decisões internas

Comentários de implementação são permitidos para preservar o motivo de uma escolha não óbvia. Coloque-os imediatamente antes do trecho a que se aplicam e mantenha-os curtos. Registre uma decisão arquitetural de alcance maior em um ADR, não em vários comentários distribuídos.

```ts
// A coluna é nomeada com a propriedade para manter relações compostas distinguíveis.
const columnName = `${relation.propertyName}_${primaryKey.propertyName}`;
```

Ao documentar um invariante, deixe claro o que deve continuar verdadeiro. Ao documentar uma pré-condição, indique quem deve satisfazê-la. Ao documentar uma pós-condição ou efeito colateral, indique o estado observável após a operação.

## TODO, FIXME e semelhantes

Use `TODO` apenas para trabalho conhecido e intencionalmente adiado. Use `FIXME` para um comportamento incorreto conhecido que ainda precisa de correção. Ambos devem explicar o motivo, a consequência e o critério para remoção; inclua a referência da issue quando ela existir.

```ts
// TODO(#42): suportar paginação por cursor quando consultas grandes forem expostas pela API.
// FIXME(#57): converter o erro do driver para OrmError antes de publicá-lo ao consumidor.
```

Não use `TODO` como substituto para requisitos indefinidos, nem `FIXME` sem um problema concreto. Remova o comentário quando o trabalho for concluído.

## Revisão

Ao revisar uma alteração, confirme que a documentação:

- explica algo que os tipos e o código não revelam;
- continua correta após a alteração;
- descreve contratos, erros e efeitos observáveis quando relevantes;
- não duplica outra fonte de verdade;
- usa TSDoc e tags somente quando elas ajudam o consumidor.
