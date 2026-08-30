# ADR 0005 — `no-any` estrito; API pública orientada a tipos

- **Status:** aceita
- **Data:** 2026-04-29
- **Decisor:** Tony Albert

## Contexto

ORMs que se apoiam em `any` (`Repository.find(criteria: any)`, `(row: any).foo`) apagam o valor
de escrever TypeScript. Tipos condicionais e generics permitem ao compilador verificar formas de
entidade, inputs parciais e linhas de resultado — mas só se `any` for proibido.

## Decisão

**`@typescript-eslint/no-explicit-any` é aplicado estritamente em todo o código.** A biblioteca
se apoia em generics, tipos condicionais e `unknown` para expor garantias de tempo de compilação
aos consumidores. Concretamente: a assinatura de `create()` exige os campos não opcionais e
rejeita entidades parciais em tempo de compilação, em vez de falhar em runtime com uma violação
de `NOT NULL`.

## Consequências

### Positivas

- Erros do consumidor aparecem na IDE, não em produção.
- O sistema de tipos codifica invariantes que o runtime só pegaria tarde demais (coluna
  obrigatória faltando, tipo de coluna errado, relação desconhecida).
- Refactors são mais seguros: renomear uma coluna na classe da entidade quebra todo call site
  mal escrito.

### Negativas / trade-offs

- O encanamento interno de tipos é mais pesado. Tipos auxiliares (`Required<>`, `Pick<>`, mapped
  types sobre as chaves de `@Column` da entidade) carregam o peso que `any` esconderia.
- Erros de compilação podem ser crípticos quando tipos condicionais resolvem através de várias
  camadas. A documentação precisa compensar.
- A produtividade do autor da biblioteca cai um pouco — usar `unknown` + narrowing cast é atrito
  que `any` removeria.

### Neutras

- Empurra a biblioteca para tipos menores e mais ortogonais. Tipos grandes de "saco de opções"
  são o primeiro lugar onde `any` volta a entrar.

## Alternativas consideradas

- **Permitir `any` em módulos internos, banir na API pública** — rejeitada: internos vazam para
  tipos públicos com mais frequência do que não.
- **Usar `unknown` em tudo** — parcialmente adotada: `unknown` é a resposta certa quando a forma
  de um valor é genuinamente opaca. A decisão aqui é especificamente contra `any`.

## Referências

- [ADR 0008 — brand `PrimaryKey<V>`](0008-pk-aware-compile-time.md), que estende esta direção
