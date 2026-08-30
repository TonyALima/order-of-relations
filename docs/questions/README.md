# Questões

Dois sabores de página vivem aqui:

- **Respostas arquivadas** — questões que receberam uma boa resposta, salvas para que futuros
  leitores (e a banca do TCC) as encontrem de novo. `status: answered`.
- **Questões em aberto** — questões de design e problemas de implementação que valem manter
  visíveis até serem decididas **e entregues**. `status: open`. Por convenção, uma questão aberta
  implica compromisso de implementar uma vez decidida — não existe estado "decidida mas não
  implementada".

Quando uma questão aberta é resolvida, seu status vira `answered`, a seção **Resposta** é
preenchida e (se ela produziu uma escolha de design) aponta para o ADR correspondente em
[decisions/](../decisions/README.md).

## Convenção de rastreamento

Cada questão aberta carrega:

- **Impacto:** `baixo | médio | alto` — o custo de deixá-la aberta.
- **Esforço:** `P | M | G` — tamanho aproximado da implementação (P ≈ uma linha, G ≈ refactor de
  vários arquivos).

## Questões em aberto

| Questão | Impacto | Esforço |
| --- | --- | --- |
| [support-one-to-many](support-one-to-many.md) — implementar `@OneToMany` / `@ManyToOne` (o membro `TO_MANY` do enum está morto hoje) | alto | G |
| [support-and-or-conditions](support-and-or-conditions.md) — estender `where` de lista AND plana para árvore booleana de verdade (AND / OR / NOT, grupos aninhados) | alto | G |
| [support-many-to-many](support-many-to-many.md) — implementar `@ManyToMany` com tabela de junção sintetizada | médio | G |
| [decorator-order-independence](decorator-order-independence.md) — independência de ordem entre `@Column` / `@Nullable` | médio | P |
| [support-user-indexes](support-user-indexes.md) — adicionar `@Index` / `@Unique`; emitir `CREATE INDEX` no schema-create | médio | M |
| [idx-discriminator-collision](idx-discriminator-collision.md) — nomear índices de discriminador STI por tabela, para duas hierarquias STI coexistirem num schema | médio | P |
| [apply-options-accumulation](apply-options-accumulation.md) — `applyOptions()` substituir vs. acumular | baixo | P |

## Questões respondidas

- [get-one-limit-1](get-one-limit-1.md) — *2026-05-14* — `getOne()` passou a emitir `LIMIT 1` no
  SQL em vez de fatiar no cliente. Entregue em `3095fbc` / `f8cdf14`.
