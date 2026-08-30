# ADR 0006 — TDD como ritmo de implementação

- **Status:** aceita
- **Data:** 2026-04-29
- **Decisor:** Tony Albert

## Contexto

ORMs fazem a maior parte do trabalho entre uma chamada de API e uma string SQL. A lógica de
tradução fica escondida dentro de tipos genéricos, metadados de decorators e composição de
cláusulas. Sem testes escritos *antes*, regressões aparecem como "comportamento estranho de
query" reportado por consumidores — tarde demais.

## Decisão

**Toda feature entra por red-green-refactor.** Escreve-se um teste que falha, faz-se passar,
depois refatora. O test runner é `bun test`.

Os arquivos de teste se dividem por **escopo**:

- **Testes de unidade** ficam colocados ao lado do código-fonte: `foo.ts` vive ao lado de
  `foo.test.ts` em `src/`. Exercitam um único módulo isoladamente; são o loop interno de
  red-green-refactor e bloqueiam todo commit.
- **Testes de integração** vivem em um diretório `tests/` no topo do repo. Exercitam
  comportamentos que cruzam vários módulos ou batem em um PostgreSQL real — padrões que não têm
  um arquivo único natural em `src/` para acompanhar.

Ambos rodam com `bun test` e são obrigatórios para o conjunto de mudanças afetado.

> **Esclarecimento (2026-04-29).** A fonte original desta decisão descrevia a colocação como
> absoluta ("em vez de uma árvore `tests/` separada"). A verificação contra o código mostrou que
> o codebase usa **os dois** layouts — testes de unidade colocados em `src/` e testes de
> integração em `tests/`. A seção Decisão acima é a regra resolvida.

## Consequências

### Positivas

- O teste é a especificação. Qualquer mudança de comportamento é necessariamente precedida por
  uma mudança de teste.
- A colocação torna os testes de unidade descobríveis por qualquer pessoa lendo o código.
- Testes de integração em um único `tests/` de topo são fáceis de enumerar, mirar
  (`bun test tests/`) e pular em ambientes sem PostgreSQL real.
- `bun test` é rápido o suficiente para manter o loop curto.

### Negativas / trade-offs

- Mais lento no *primeiro* commit de uma feature. A disciplina se paga ao longo da vida do
  projeto, não em nenhuma hora individual.
- O tooling precisa ignorar `*.test.ts` em builds de produção (resolvido pelos defaults do Bun).

### Neutras

- Encoraja unidades pequenas e testáveis. Funções difíceis de testar são refatoradas antes de
  crescer.

## Alternativas consideradas

- **Testes integration-first** — parcialmente adotada: testes end-to-end contra PostgreSQL real
  continuam existindo e são valiosos, agora com casa própria em `tests/`. Mas o *ritmo* — o que
  bloqueia um commit em nível de unidade — é o teste de unidade que falha ao lado do código.
- **Todos os testes em uma árvore `tests/` separada** — rejeitada: a distância do código-fonte
  corrói o hábito de escrever testes de unidade. `tests/` é só para escopo de integração.
- **Todos os testes colocados, sem `tests/`** — rejeitada (pelo esclarecimento acima): testes de
  integração que cruzam módulos ou exigem banco vivo não têm um arquivo-fonte único natural.
  Forçar colocação nesses casos produz donos artificiais.

## Referências

- [ADR 0007 — Bun como toolchain único](0007-bun-toolchain.md)
