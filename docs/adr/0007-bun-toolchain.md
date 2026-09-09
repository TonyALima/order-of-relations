# ADR-0007: Bun como toolchain do projeto

## Status

Accepted

## Contexto

Uma biblioteca TypeScript pode acumular ferramentas separadas para executar
código, instalar dependências, testar, compilar e formatar. Essa combinação
cria configurações e versões adicionais sem necessidade para o fluxo de
contribuição deste ORM.

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
