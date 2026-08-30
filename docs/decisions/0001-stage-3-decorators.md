# ADR 0001 — Usar decorators ECMAScript Stage-3

- **Status:** aceita
- **Data:** 2026-04-29
- **Decisor:** Tony Albert

## Contexto

O OOR mapeia classes TypeScript para tabelas PostgreSQL usando decorators (`@Entity`, `@Column`,
etc.). Existem dois dialetos viáveis de decorators:

1. **Decorators legados do TypeScript** — `experimentalDecorators: true` + o polyfill de runtime
   `reflect-metadata`. Usados por TypeORM, NestJS e Inversify.
2. **Decorators ECMAScript Stage-3** — a proposta padronizada, suportada nativamente pelo
   TypeScript moderno e pelos runtimes. Assinatura diferente, sem dependência de
   `Reflect.metadata`.

A escolha precisa ser feita antes de qualquer decorator ser escrito, porque os dois dialetos têm
assinaturas de função incompatíveis.

## Decisão

**Usaremos decorators ECMAScript Stage-3 exclusivamente.** Os metadados ficam em um
`MetadataStorage` (um `Map`) pertencente à biblioteca, não em `Reflect`.

## Consequências

### Positivas

- Sem dependência de runtime em `reflect-metadata`. Uma dependência transitiva a menos para os
  consumidores.
- Alinhamento com o pipeline de padronização da linguagem — o dialeto é o futuro, não um caminho
  de compatibilidade legado.
- Suporte nativo nas toolchains modernas (incluindo Bun) sem flags extras de `tsconfig`.
- A biblioteca é dona do próprio layout de metadados. O formato de armazenamento pode evoluir sem
  colidir com qualquer outra coisa que use `Reflect.metadata` na aplicação do consumidor.

### Negativas / trade-offs

- A assinatura de decorator Stage-3 é mais verbosa que a forma legada (o parâmetro `context` é
  obrigatório).
- Ecossistema de helpers menor. Utilitários de decorator escritos para o dialeto legado não se
  aplicam.
- Parte das IDEs e do material de referência ainda assume o dialeto legado por padrão — o
  onboarding de contribuidores custa um parágrafo de explicação.

### Neutras

- Força uma abstração `MetadataStorage` própria (ver
  [components/metadata-storage.md](../components/metadata-storage.md)). Também é um ganho de
  testabilidade, mas é sobretudo *diferente*, não *melhor* que a abordagem legada.

## Alternativas consideradas

- **`experimentalDecorators` + `reflect-metadata`** — rejeitada: legado, exige polyfill e prende a
  biblioteca a uma flag hoje considerada transicional.
- **Codegen em build-time em vez de decorators** — rejeitada: destrói o caso ergonômico de um ORM.
  Decorators são o que os consumidores esperam.

## Referências

- [Conceito: ECMAScript Stage-3 Decorators](../concepts/stage-3-decorators.md)
- [Comparação: Stage-3 vs decorators legados](../comparisons/stage-3-vs-legacy-decorators.md)
