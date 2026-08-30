# ADR 0003 — Container de DI singleton, intencionalmente mínimo

- **Status:** aceita (design pretendido; **ainda não implementado**)
- **Data:** 2026-04-29
- **Decisor:** Tony Albert

> **Nota de implementação.** O código em `src/` **ainda não** tem `Container`, `@Service`,
> `@Inject` nem `@InjectRepository`. Os exemplos atuais usam construção direta:
>
> ```ts
> export const db = new Database();
> const userRepository = new Repository(User, db);
> ```
>
> Esta ADR descreve o design pretendido — a fronteira que ela fixa (container acima da camada de
> persistência; repositórios construíveis sem ele). Quando o DI aterrissar, esta nota deve ser
> removida.

## Contexto

Repositórios precisam ser conectados a serviços. Três posições disponíveis:

1. Manual: o consumidor faz `new Repository(...)` e passa instâncias adiante.
2. Usar uma biblioteca de DI séria (Inversify, tsyringe).
3. Construir um container pequeno, interno.

A posição 1 não escala ergonomicamente além de dois serviços. A posição 2 importa uma dependência
grande para o que, no caso do OOR, é um único caso de uso (injetar um repositório em um serviço).

## Decisão

**Um único `Container` guarda singletons de serviço.** `@Service` envolve um construtor de modo
que campos `@Inject` e `@InjectRepository` sejam preenchidos automaticamente. O container é
intencionalmente mínimo — um único escopo (singleton), sem resolução assíncrona, sem hooks de
ciclo de vida.

## Consequências

### Positivas

- Zero dependência externa de DI.
- O caso dos 90% (ligar um repositório a um serviço) vira um decorator.
- O container é pequeno o suficiente para ser lido de ponta a ponta — sem surpresas.

### Negativas / trade-offs

- Sem instâncias com escopo de request. Quem precisar de escopo gerencia manualmente.
- Sem factories assíncronas. Se um serviço precisa de init assíncrono, ele expõe um `init()` e o
  consumidor chama.
- Não vai satisfazer quem quer IoC completo. Esses usuários devem usar Inversify ou tsyringe.

### Neutras

- Fixa um escopo claro: o container existe para injeção de repositórios. Se acumular features
  além disso, é um smell a ser combatido.
- A fronteira pretendida, quando o DI aterrissar, é o container ficar **acima** da camada de
  persistência — ele compõe serviços e lhes entrega repositórios — e nunca participar de
  resolução de metadados ou execução de SQL. Repositórios devem continuar construíveis sem o
  container, para que testes e scripts pontuais não paguem por ele.

## Alternativas consideradas

- **Inversify / tsyringe** — rejeitadas: superfície demais para a necessidade real, e empurram os
  consumidores a adotar seus padrões no projeto inteiro.
- **Sem container, wiring manual** — rejeitada: a ergonomia é ruim o bastante para os consumidores
  inventarem o próprio container de qualquer jeito.

## Referências

- [Conceito: Dependency Injection Container](../concepts/di-container.md)
