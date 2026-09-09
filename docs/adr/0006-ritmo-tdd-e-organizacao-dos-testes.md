# ADR-0006: Adotar TDD e organizar testes por escopo

## Status

Accepted

## Contexto

Grande parte do comportamento do ORM resulta da combinação entre metadados de
decoradores, tipos genéricos e composição de SQL. Regressões nessa tradução
podem aparecer ao consumidor apenas como consultas inesperadas. O projeto
precisa de um ciclo de desenvolvimento que torne a mudança de comportamento
observável antes da implementação e mantenha a responsabilidade de cada teste
clara.

A organização atual combina testes próximos aos módulos em `src/`, testes de
integração em `tests/` e cenários de PostgreSQL junto a `Database`, quando o
componente que cria o esquema é sua propriedade natural. O
[guia de testes](../testing.md) descreve os procedimentos e as convenções em
vigor.

## Decisão

Adotar o ciclo red-green-refactor: cada mudança de comportamento começa com um
teste que falha, recebe a implementação mínima para ficar verde e só então é
refatorada.

Testes unitários ficam próximos ao módulo em `src/` quando verificam uma regra
local. Testes de integração ficam em `tests/` quando exercitam a colaboração
pela API pública. Cenários que dependem de PostgreSQL podem permanecer junto ao
componente responsável pelo esquema se essa localização expressar melhor sua
propriedade. A classificação é determinada pelo escopo e pela dependência de
infraestrutura, não somente pelo diretório.

## Alternativas consideradas

- Testar integração primeiro: valida fluxos reais, mas torna lento e menos
  preciso o ciclo de desenvolvimento de regras locais.
- Manter todos os testes em `tests/`: centraliza a enumeração, mas afasta os
  testes unitários do código que especificam.
- Colocar todo teste ao lado do código: favorece módulos isolados, mas não dá
  um dono natural a fluxos que atravessam componentes.

## Consequências

- Testes passam a servir como especificação executável de mudanças de
  comportamento, reduzindo regressões silenciosas.
- A proximidade dos testes unitários facilita descobrir contratos locais; a
  separação dos fluxos de integração evidencia seus requisitos de ambiente.
- Escrever o teste inicial aumenta o custo imediato de uma alteração, mas
  reduz a incerteza durante a implementação e a manutenção.
- A equipe precisa escolher o nível pelo comportamento coberto e manter os
  dois níveis independentes, evitando duplicar a mesma prova.

Para a estrutura atual, nomes, isolamento e execução da suíte, consulte o
[guia de testes](../testing.md).
