# ADR-0005: API estrita, sem `any`

## Status

Accepted

## Contexto

Uma API pública tipada perde seu valor quando aceita ou retorna `any`: o
compilador deixa de verificar a forma da entidade e dos valores que cruzam a
API. Isso é especialmente relevante para um ORM, em que uma incompatibilidade
entre propriedade, chave primária ou condição pode só aparecer no PostgreSQL.

Esta decisão histórica foi recuperada de registros que preservam seu contexto.
Ela foi conferida contra o projeto atual: `tsconfig.json` mantém `strict`, o
perfil recomendado de `typescript-eslint` está ativo em `eslint.config.ts` e
configura `@typescript-eslint/no-explicit-any` como erro, e o barril público em
`src/index.ts` expõe contratos genéricos como `Repository<T>`, `Conditions<T>`
e `PrimaryKey<V>`.

## Decisão

Não usar `any` explícito no código. A API pública preserva as relações entre
tipos por meio de genéricos, tipos condicionais e tipos mapeados; eles devem
continuar sendo preferidos a apagar essas relações.

`unknown` é a escolha para um valor cuja forma seja realmente desconhecida,
como um valor vindo de uma fronteira dinâmica. Ele deve ser validado ou
refinado antes de uso. Um cast localizado é aceitável somente na fronteira em
que o código já estabeleceu a informação necessária; ele não deve propagar um
tipo frouxo pela API nem substituir validação de dados externos.

Por exemplo, `Conditions<T>` associa cada propriedade de `T` a um
`FieldConditionBuilder<Unbrand<T[K]>>`, e `Repository<T>` recebe `PKInput<T>`
em `findById()`. Esses contratos preservam a relação entre entidade, chave e
valor de comparação; não validam, por si só, dados recebidos do banco ou
metadados criados em tempo de execução.

## Alternativas consideradas

- Permitir `any` apenas nos módulos internos e proibi-lo na API pública. Foi
  rejeitada porque tipos internos participam das assinaturas públicas e esse
  limite tende a vazar.
- Substituir todos os tipos por `unknown`. Foi rejeitada: `unknown` é correto
  em fronteiras opacas, mas não representa relações já conhecidas entre os
  tipos da entidade, das chaves e das consultas.
- Aceitar entradas frouxas e depender de erros do PostgreSQL. Foi rejeitada
  porque transforma incompatibilidades que podem ser expressas nos contratos
  em falhas tardias de execução.

## Consequências

### Positivas

- Chamadas incompatíveis com os contratos genéricos existentes são detectadas
  pelo TypeScript antes da execução.
- Refatorações preservam a ligação entre a entidade e as operações que usam
  seus tipos.
- Fronteiras dinâmicas ficam explícitas por `unknown`, exigindo tratamento
  antes de serem consumidas.

### Custos e limites

- Tipos condicionais e mapeados tornam a implementação interna e algumas
  mensagens de erro mais complexas.
- Autores da biblioteca precisam refinar `unknown` e limitar casts, em vez de
  usar um atalho que suprima a verificação.
- A tipagem estática não substitui validação em tempo de execução para dados
  do PostgreSQL, metadados refletidos ou outras entradas dinâmicas.

## Referências

- [Configuração TypeScript](../../tsconfig.json)
- [Configuração ESLint](../../eslint.config.ts)
- [API pública](../../src/index.ts)
- [Tipos de consulta](../../src/query-builder/types.ts)
- [Tipos de chave primária](../../src/types.ts)
