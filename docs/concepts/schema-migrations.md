# Schema Migrations

> **Ainda não implementado.** O OOR **não** tem sistema de migrations em `src/`. O que existe hoje:
> `Database.create()` e `Database.drop()` (rebuild completo, seguro apenas contra banco vazio ou
> em testes). Tudo descrito abaixo está por construir.

## Definição

**Schema migrations** são transformações versionadas, ordenadas e reexecutáveis que evoluem um
banco populado de um estado de schema para outro **sem destruir dados**. São a contraparte de
produção do `create()` / `drop()` do [Database](../components/database.md), que são operações de
rebuild completo.

Exemplos de operações que precisam de migrations:

- Adicionar uma coluna a uma tabela existente sem perder linhas.
- Renomear uma coluna ou mudar um tipo (`int` → `bigint`, `text` → `varchar(255)`).
- Adicionar ou remover índices / unique constraints / foreign keys.
- Backfill de colunas novas com valores computados a partir de linhas existentes.
- Registrar quais migrations já foram aplicadas (tipicamente uma tabela `schema_versions` ou
  `schema_migrations`).

## Por que um conceito separado (e não um método de `Database`)

Migrations precisam de coisas que `Database.create()` não tem:

- **Estado.** Migrations rastreiam o que já foi aplicado; um `create()` novo não.
- **Ordenação.** Migrations precisam rodar numa sequência definida; `create()` é uma operação de
  conjunto-de-tabelas única.
- **Reversibilidade (ou one-way explícito).** Alguns modelos suportam `up()`/`down()`; outros são
  forward-only com disciplina de roll-forward.
- **Idempotência em nível de migration.** Re-executar uma migration aplicada é no-op (ou erro);
  `create()` é fundamentalmente não-idempotente contra um banco populado.
- **Execução fora de ciclo.** Migrations podem disparar como parte de um deploy, não a cada
  startup de processo. `Database.create()` roda em testes o tempo todo.

Empacotar isso em `Database` inflaria a classe além do seu escopo atual de "três trabalhos"
(conexão / hospedeiro de metadados / ciclo de vida de schema). O argumento de responsabilidade
única que mantém `Database` pequena vale ao contrário: migrations querem uma casa própria.

## Escopo futuro (decisões a tomar quando isso for desenhado)

Quando o sistema de migrations do OOR for construído de fato, estas são as escolhas estruturais
que devem virar ADR, cada uma:

1. **Modelo de versionamento:** inteiros sequenciais (`0001_init.sql`)? timestamps
   (`20260429-add-email.ts`)? hashes endereçáveis por conteúdo? Sequencial é o mais simples;
   timestamps evitam conflitos de merge em branches concorrentes.
2. **Forward-only vs. up/down:** toda migration precisa de um `down()` que a reverta?
   Forward-only é operacionalmente mais simples; up/down é mais flexível, mas adiciona custo de
   manutenção.
3. **TS-first vs. SQL-first:** migrations são arquivos TypeScript que emitem SQL via o
   [builder](lazy-query-builder.md) / `sqlJoin`, ou arquivos `.sql` crus? TS-first compõe com o
   sistema de tipos; SQL-first é mais transparente.
4. **Arquitetura do runner:** o runner vive no OOR, ou o usuário faz o próprio wiring? Um runner
   dentro da biblioteca é ergonômico; controlado pelo usuário dá flexibilidade.
5. **Localização da tabela de migrations:** pertencente ao OOR (`oor_schema_versions`) ou nomeada
   pelo usuário?
6. **Relação com `Database.create()`:** `create()` grava um baseline "versão 0" sobre o qual as
   migrations constroem, ou migrations e `create()` descrevem o mesmo estado final por caminhos
   diferentes?

Nenhuma dessas está decidida. Quando chegar a hora, cada uma vira um ADR em
[decisions/](../decisions/README.md).

## Conexões

- [components/database.md](../components/database.md) — dona de `create()` / `drop()`; o futuro
  runner de migrations viverá ao lado (ou acima) dela.
- [architecture.md — schema create/drop](../architecture.md#schema-createdrop) — o fluxo
  existente; migrations são o caminho *não-isto* para dados de produção.
