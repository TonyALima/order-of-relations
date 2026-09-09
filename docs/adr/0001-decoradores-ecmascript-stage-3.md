# ADR-0001: Usar decoradores ECMAScript Stage 3

## Status

Accepted

## Contexto

O ORM mantém o mapeamento junto às classes de entidade. Decoradores como
`@Entity`, `@Column` e `@ToOne` descrevem tabelas, colunas e relações; essas
informações precisam ser reunidas durante a declaração da classe para que
`Database` possa criar o esquema e para que repositórios e consultas conheçam
o mapeamento.

Há dois modelos de decoradores em TypeScript: os decoradores legados e os
decoradores ECMAScript Stage 3. Eles têm assinaturas, ciclo de execução e
mecanismos de metadados incompatíveis. A biblioteca precisa estabelecer um
único modelo antes de ampliar os decoradores, pois essa escolha orienta tanto
sua implementação quanto a configuração exigida de quem a consome.

Os metadados também devem permanecer associados à instância de `Database`
usada pela entidade. Aplicações e testes podem manter conjuntos de entidades
independentes em instâncias diferentes, portanto o registro não pode introduzir
estado global compartilhado entre elas.

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
