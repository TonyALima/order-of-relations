# ADR-0007: Bun como toolchain do projeto

## Status

Accepted

## Contexto

Uma biblioteca TypeScript pode acumular ferramentas separadas para executar
código, instalar dependências, testar, compilar e formatar. Essa combinação
cria configurações e versões adicionais sem necessidade para o fluxo de
contribuição deste ORM.

Esta decisão histórica foi recuperada de registros que preservam seu contexto
e alternativas. Ela foi conferida contra o projeto atual: `bun.lock` é o
lockfile, os comandos documentados usam Bun e `package.json` define `bun
build`, `bunx tsc`, `bun --bun eslint` e `bun --bun prettier`.

## Decisão

Bun é a ferramenta única para instalar dependências, executar arquivos
TypeScript, rodar testes, gerar o build e carregar `.env` durante o
desenvolvimento. O acesso do ORM ao PostgreSQL também usa o `SQL` do Bun.

Isso não elimina as ferramentas auxiliares executadas pelo Bun: TypeScript 7
é o verificador de tipos, enquanto o alias TypeScript 6 atende à API usada por
ESLint; ESLint verifica o código, Prettier formata e Husky executa o hook de
pré-commit. Essas ferramentas permanecem declaradas em `package.json` e são
invocadas pelos scripts ou hooks, sem introduzir Node, npm, yarn, pnpm, Jest,
Vitest, `ts-node`, `tsx`, webpack, tsup ou Rollup no fluxo do projeto.

Esta decisão define o ambiente de contribuição. Ela não afirma compatibilidade
ou portabilidade do pacote publicado para outros runtimes.

## Alternativas consideradas

- Node com `tsx`, pnpm e Vitest: rejeitada por exigir múltiplos binários e
  configurações para os mesmos papéis já cobertos pelo Bun neste projeto.
- Deno: rejeitada por divergir mais das dependências e convenções do
  ecossistema npm, sem benefício necessário para este ORM.

## Consequências

### Positivas

- Contribuidores usam `bun install` e os comandos `bun` documentados em um
  único ambiente de execução.
- Testes, exemplos, build, `.env` e a conexão SQL compartilham o runtime Bun.
- As versões e o papel de TypeScript, ESLint, Prettier e Husky permanecem
  explícitos no manifesto de dependências.

### Custos e limites

- Contribuidores precisam de Bun 1.3 ou superior.
- Incompatibilidades pontuais de dependências com Bun ainda podem exigir
  investigação durante o desenvolvimento.
- Atualizações do TypeScript usado na verificação devem preservar o alias
  TypeScript 6 exigido pelo ESLint.

## Referências

- [Manifesto de dependências e scripts](../../package.json)
- [Lockfile do Bun](../../bun.lock)
- [Configuração TypeScript](../../tsconfig.json)
- [Configuração ESLint](../../eslint.config.ts)
- [Guia de desenvolvimento](../development.md)
