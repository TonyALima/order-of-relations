# order-of-relations

Biblioteca ORM experimental para PostgreSQL, escrita em TypeScript. Ela usa decoradores ECMAScript Stage 3 para mapear entidades e disponibiliza criação de esquema, repositórios e consultas tipadas.

## Contexto e limites

- PostgreSQL é a única base suportada. Não introduza abstrações para outros bancos sem um requisito explícito.
- O mapeamento fica próximo das entidades: decoradores registram os metadados; `Database` cria ou remove o esquema a partir deles; `Repository` e `QueryBuilder` fazem persistência e consultas.
- Preserve os contratos de relações `ToOne`, chaves estrangeiras compostas, nulabilidade, herança com discriminador e geração de chaves no cliente ou no banco.
- O pacote público é exportado por `src/index.ts`. Atualize esse ponto de entrada quando uma API pública nova ou removida exigir isso.

## Estrutura relevante

- `src/`: implementação principal, incluindo metadados, banco de dados, repositórios, construção de consultas, tipos, erros e testes unitários próximos ao código.
- `tests/`: testes de integração, inclusive operações que acessam PostgreSQL.
- `examples/basic-crud/` e `examples/inheritance/`: fluxos executáveis e documentação prática da API.
- `docs/`: diagrama de classes e convenções de documentação no código.

## Ambiente e comandos

Use Bun 1.3 ou superior. Use Bun, nunca Node, npm, yarn, pnpm, Jest ou Vitest.

```bash
bun install
bun test
bun run typecheck
bun run lint
```

O Bun carrega `.env` automaticamente. Testes e exemplos que acessam o banco exigem `DATABASE_URL`, por exemplo:

```env
DATABASE_URL=postgres://usuario:senha@localhost:5432/order_of_relations
```

Para executar os exemplos:

```bash
bun examples/basic-crud/index.ts
bun examples/inheritance/index.ts
```

O exemplo de CRUD recria as tabelas do exemplo. Nunca o execute apontando para um banco que contenha dados importantes.

## TypeScript e qualidade

- O `bun run typecheck` usa TypeScript 7 por meio de `@typescript/native`.
- O ESLint usa a API do TypeScript 6 por meio do alias `typescript`. Não substitua esse alias diretamente por TypeScript 7: isso interrompe o lint.
- Mantenha as verificações estritas do `tsconfig.json`; não enfraqueça tipos para contornar erros.
- Não use `any`. Modele o tipo, use genéricos ou `unknown` com validação adequada.
- Não use `sql.unsafe`. Toda consulta deve ser parametrizada pelo query builder ou por templates `sql` parametrizados.

## Alterações de comportamento

Siga TDD para funcionalidades e correções: escreva primeiro um teste que falhe, implemente o mínimo necessário e refatore com a suíte verde. Cubra tanto o comportamento esperado quanto os erros, especialmente em mapeamento, chaves compostas, nulabilidade, herança e geração de chaves.

Antes de concluir uma alteração de código, execute as verificações aplicáveis:

```bash
bun test
bun run typecheck
bun run lint
```

Se a alteração usa PostgreSQL, execute também os testes de integração com uma `DATABASE_URL` de desenvolvimento. Não esconda falhas com `test.only`, `test.skip`, desativação de regras ESLint ou mudanças na configuração, salvo quando isso fizer parte explícita do requisito.

## Documentação

Leia e siga `docs/code-documentation.md` ao mudar APIs públicas ou comportamento relevante. Prefira código, nomes e tipos claros; use TSDoc apenas para contratos, restrições, efeitos no banco, erros e decisões que não fiquem evidentes na assinatura e implementação.

Mantenha a documentação coerente com a alteração:

- atualize o `README.md` quando mudar instalação, configuração, comandos, capacidades públicas ou o fluxo de uso;
- atualize os exemplos quando mudarem a API que eles demonstram;
- atualize `docs/class-diagram.md` quando a estrutura de classes mudar.

## Política de memória e commits

- Só adicione memórias após confirmação explícita do usuário.
- Não use `--no-verify` e não desative a assinatura GPG para contornar problemas de commit.
- Não inclua especificações, planos ou artefatos de planejamento em commits, a menos que o usuário peça isso explicitamente.
