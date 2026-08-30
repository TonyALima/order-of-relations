# Como o OOR deveria evitar colisões de nome `idx_discriminator` entre hierarquias STI?

> Status: **aberta** (bug latente) · Impacto: **médio** · Esforço: **P**

## Questão

`Database.createBaseTables()` emite, por tabela raiz STI:

```sql
ALTER TABLE <tableName> ADD COLUMN discriminator TEXT NOT NULL;
CREATE INDEX idx_discriminator ON <tableName>(discriminator);
```

O nome literal `idx_discriminator` é compartilhado por **toda** raiz STI de um schema. A primeira
hierarquia cria o índice; o segundo `db.create()` para uma segunda hierarquia STI no mesmo banco
bate num erro PostgreSQL `relation already exists`.

**Hoje é latente.** Os exemplos e testes do OOR usam uma hierarquia STI por vez. Um consumidor
real com duas raízes STI não relacionadas num schema tropeçaria nisso imediatamente.

## Por que importa

1. **Nomes de índice no PostgreSQL têm escopo de schema**, não de tabela. `idx_discriminator` é
   um identificador global dentro do schema; duas tabelas não podem compartilhá-lo.
2. **`db.create()` é o único ponto de entrada do OOR para setup de schema hoje** (sem
   migrations). A primeira falha é um hard stop com mensagem nada óbvia — o PG dirá
   `relation "idx_discriminator" already exists`, não "você tem duas hierarquias STI".
3. **O caminho latente fica invisível durante TDD** porque todo teste existente semeia um schema
   com uma hierarquia.

## Soluções candidatas

### Opção A — nome por tabela

```sql
CREATE INDEX idx_<tableName>_discriminator ON <tableName>(discriminator);
```

- **Pró:** único por construção. Lê naturalmente no output de `\d`. Sem metadados extras.
- **Pró:** casa com a convenção default de nomes de índice do próprio PostgreSQL
  (`<table>_<column>_idx` é o padrão dos índices de PK gerados por `SERIAL PRIMARY KEY`).
- **Contra:** nomes muito longos se `tableName` for longo. O limite de identificador do PG é 63
  bytes — risco de truncamento para nomes de tabela muito longos.
- **Contra:** refactor pequeno — o nome do índice precisa ser derivado no mesmo lugar em que o
  `CREATE INDEX` é emitido.

### Opção B — nome por discriminador qualificado

```sql
CREATE INDEX <tableName>_discriminator_idx ON <tableName>(discriminator);
```

Igual à A, mas com a ordem de sufixo do default do PG (`_idx` por último). Trade-offs idênticos;
só uma escolha de estilo.

### Opção C — nome do índice nos metadados

Adicionar um campo `indexName: string` nos metadados STI, com default
`idx_<tableName>_discriminator`. Permite override do usuário via opção de decorator (ex.:
`@Entity({ discriminatorIndexName: '...' })`).

- **Pró:** à prova de futuro se [support-user-indexes](support-user-indexes.md) aterrissar; a
  mesma forma cobre índices implícitos e explícitos.
- **Contra:** mais superfície para uma feature de um único caso de uso conhecido.

### Opção D — manter `idx_discriminator`, documentar a colisão

Não fazer nada no código; documentar o limite ("uma hierarquia STI por schema") em
[concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md).

- **Pró:** custo zero de implementação.
- **Contra:** empurra um problema real de corretude com a barriga. A superfície de erro
  (`relation already exists` do PG) não ajuda a depurar.

## Direção tentativa

Opção A ou B (nome qualificado pela tabela) é a correção menor e mais defensável, e se alinha com
o que o PostgreSQL gera sozinho em outros lugares. Opção C é over-engineering para o escopo
atual. Opção D empurra o bug com a barriga.

Se [support-user-indexes](support-user-indexes.md) introduzir depois um decorator `@Index` que
emite `CREATE INDEX <name> ON ...`, o índice STI implícito vira um caso específico do mecanismo
geral — e o campo de metadados da Opção C sai de graça. Então **começar com A ou B; revisitar
se/quando `@Index` aterrissar**.

## Critérios de decisão

- A correção deve ser uma mudança localizada em `Database.createBaseTables()`.
- O nome novo do índice precisa respeitar o limite de 63 bytes do PG em nomes de tabela
  realistas (truncar com sufixo de checksum só se necessário).
- Um teste de regressão deve registrar duas hierarquias STI num schema e afirmar que ambos os
  `CREATE INDEX` têm sucesso sem colisão.

## Ver também

- [concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md) — o conceito;
  precisa de atualização quando isto for decidido.
- [components/database.md](../components/database.md) — hospedeiro de `createBaseTables()`.
- [architecture.md — schema create/drop](../architecture.md#schema-createdrop) — o fluxo que
  emite os três statements por raiz STI.
- [support-user-indexes](support-user-indexes.md) — questão relacionada; se `@Index` for
  entregue, esta questão pode se fundir nela.
