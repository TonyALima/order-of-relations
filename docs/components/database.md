# Database

Módulo: `src/core/database/` · Exporta: `Database`

## Propósito

`Database` é o hospedeiro de conexão e metadados. Toda entidade se registra contra uma instância
dela (`@Entity(db)`), todo repositório é construído contra uma (`new Repository(User, db)`), e o
ciclo de vida do schema é um de seus três trabalhos.

## Os três trabalhos

`Database` faz exatamente três coisas:

### 1. Conexão

Envolve uma instância `SQL` do Bun. `connect(url?)` usa a URL fornecida ou cai no default do Bun
(que lê `DATABASE_URL` do ambiente). `getConnection()` devolve o handle `SQL` e lança
`DatabaseNotConnectedError` se `connect()` ainda não foi chamado.

O wrapper é fino: quem fala com o `SQL` do Bun são o [QueryBuilder](query-builder.md) e os
caminhos de escrita do [Repository](repository.md), que obtêm o handle e o usam.

### 2. Hospedeiro de metadados

É dona do [MetadataStorage](metadata-storage.md) das entidades registradas contra esta instância.
Exposto via `db.getMetadata()`. Duas instâncias de `Database` no mesmo processo significam dois
mapas de metadados independentes — este é o local canônico da regra "por-`Database`, não
por-biblioteca".

### 3. Ciclo de vida do schema

`create()` materializa o schema em duas passagens (ver
[architecture.md — create/drop](../architecture.md#schema-createdrop)):

1. Emite `CREATE TABLE` para cada entidade (colunas + primary keys, sem FKs). Para raízes STI,
   também `ALTER TABLE ... ADD COLUMN discriminator TEXT NOT NULL` e
   `CREATE INDEX idx_discriminator ON <root>(discriminator)`. Entidades filhas (cujo `tableName`
   coincide com o da raiz) são puladas nesta passagem — STI é uma tabela só para a hierarquia
   inteira.
2. Emite `ALTER TABLE ... ADD FOREIGN KEY` para cada relação.

`drop()` percorre o grafo de relações em ordem topológica reversa, de modo que alvos de FK são
derrubados depois de quem os referencia.

> Migrations além de create/drop estão fora do escopo desta classe — ver
> [concepts/schema-migrations.md](../concepts/schema-migrations.md).

## Construção e ciclo de vida

Uso típico:

```ts
export const db = new Database();
db.connect(); // usa DATABASE_URL por padrão

@Entity(db)
class User {
  /* ... */
}

await db.create(); // emite DDL para User e demais entidades registradas em db
```

A classe é instanciada **antes** de qualquer declaração `@Entity`, já que cada `@Entity(db)` a
referencia. A avaliação dos decorators popula `db.getMetadata()`; a conexão com o banco pode ser
aberta depois, via `connect()`.

## Por que uma classe, três trabalhos?

Separar conexão / metadados / schema em três classes exigiria passar os três handles juntos por
todo lado — todo site que usa um tende a usar os outros. O agrupamento é ancorado no que eles
compartilham: o ciclo de vida do schema lê metadados e escreve na conexão; a execução de queries
lê metadados e escreve na conexão. Mantê-los em um objeto só mantém a superfície da API enxuta.

## API pública (estado atual do código)

| Membro | Assinatura | Notas |
| --- | --- | --- |
| `connect` | `(url?: string) => void` | Inicializa a conexão; sem URL, usa `DATABASE_URL`. |
| `getConnection` | `() => SQL` | Lança `DatabaseNotConnectedError` se desconectado. |
| `getMetadata` | `() => MetadataStorage` | O storage desta instância. |
| `create` | `() => Promise<void>` | Cria tabelas e relações (duas passagens). |
| `drop` | `() => Promise<void>` | Derruba tabelas em ordem topológica reversa. |

## Conexões

- [MetadataStorage](metadata-storage.md) — o mapa por-`Database` que esta classe hospeda.
- [architecture.md](../architecture.md) — os fluxos de `create()`/`drop()` e o posicionamento em
  camadas do `Database`.
- [concepts/single-table-inheritance.md](../concepts/single-table-inheritance.md) — de onde vêm o
  discriminador e o índice implícito.
