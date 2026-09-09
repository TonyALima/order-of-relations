# ADR-0001: Usar decoradores ECMAScript Stage 3

## Status

Accepted

## Contexto

O mapeamento de entidades do ORM é declarado por decoradores, como `@Entity`,
`@Column` e `@ToOne`. Os decoradores legados do TypeScript e os decoradores
ECMAScript Stage 3 possuem assinaturas incompatíveis; a escolha define como os
metadados são registrados e quais requisitos são impostos aos consumidores.

O projeto já usa os contextos dos decoradores Stage 3. Os decoradores de campo
registram dados em `context.metadata` e `@Entity` consolida esses dados em um
`MetadataStorage` pertencente à instância de `Database`. A configuração do
TypeScript não habilita `experimentalDecorators`, e as dependências não incluem
`reflect-metadata`.

## Decisão

Usar exclusivamente decoradores ECMAScript Stage 3. Os decoradores usarão
`context.metadata` durante a declaração da classe, e o ORM armazenará o
mapeamento final em seu próprio `MetadataStorage`, isolado por `Database`.

O ORM não usará `reflect-metadata` nem inferirá tipos de coluna a partir de
metadados de design; tipos de coluna permanecem explícitos no mapeamento.

## Alternativas consideradas

- Decoradores legados do TypeScript com `experimentalDecorators` e
  `reflect-metadata`: rejeitados por exigirem uma API incompatível, flags de
  compilação específicas e um registro global de metadados.
- Geração de código em vez de decoradores: rejeitada porque deslocaria o
  mapeamento para fora das entidades e não atende ao modelo de uso do ORM.

## Consequências

- Consumidores não precisam instalar nem importar `reflect-metadata`.
- Cada instância de `Database` mantém seu próprio conjunto de metadados, sem
  compartilhar estado de mapeamento com outras instâncias.
- Implementações e extensões de decoradores devem usar os contextos Stage 3;
  utilitários feitos para decoradores legados não são compatíveis.
- As colunas devem informar seu tipo SQL explicitamente, pois o ORM não usa
  metadados de design em tempo de execução.
