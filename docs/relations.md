# Relações `ToOne`

`ToOne` representa uma referência de uma entidade para uma única entidade alvo.

O exemplo completo em [examples/relations/index.ts](../examples/relations/index.ts)
cria e remove suas próprias tabelas de desenvolvimento. Execute-o com uma URL
de PostgreSQL descartável:

```bash
DATABASE_URL=postgresql://usuario:senha@localhost:5432/desenvolvimento bun examples/relations/index.ts
```

## Declaração e registro

Importe os decoradores pela API pública e associe a propriedade a uma função que
retorna o construtor da entidade alvo:

```ts
import { Nullable, ToOne } from 'order-of-relations';

@ToOne({ target: () => Profile })
@Nullable
profile?: Profile;
```

O `target` é um *thunk*: a função só é avaliada quando os metadados são
resolvidos. Portanto a classe alvo pode aparecer depois da classe que a
referencia. Ainda assim, todas as classes devem ter sido registradas com
`@Entity` antes de chamar `db.create()` ou de consultar os metadados; caso
contrário, a relação não encontra sua entidade alvo.

`@Nullable` ou `@NotNullable` é obrigatório e deve ser aplicado antes de
`@ToOne` (o decorador mais próximo da propriedade é aplicado primeiro). Uma
relação opcional recebe colunas de FK que aceitam `NULL`; uma relação obrigatória
cria essas colunas com `NOT NULL`.

## Colunas de chave estrangeira

A API atual não recebe nomes de coluna em `@ToOne`. Os nomes físicos são
derivados de forma determinística: para cada propriedade de chave primária da
entidade alvo, a FK é `<propriedadeDaRelação>_<propriedadeDaPK>`. Assim, o nome
da propriedade da relação é a parte explicitamente escolhida no mapeamento.
Metadados já resolvidos podem conter nomes explícitos, mas eles são internos;
não há uma opção pública para configurá-los no decorador.

| Propriedade da relação | PK alvo | Coluna FK criada |
| --- | --- | --- |
| `profile` | `id` | `profile_id` |
| `orderItem` | `orderId`, `productId` | `orderItem_orderId`, `orderItem_productId` |

Para a chave composta, basta declarar cada parte como `@PrimaryColumn` na
entidade alvo. `ToOne` cria uma coluna de FK por parte e a restrição referencia
as duas na mesma ordem da chave primária.

Quando a PK usa um tipo gerador, a FK usa o tipo inteiro correspondente: `SERIAL`
vira `INTEGER`, `SMALLSERIAL` vira `SMALLINT` e `BIGSERIAL` vira `BIGINT`. Isso
evita que a coluna de referência crie uma sequência própria; a geração continua
somente na PK alvo. Os demais tipos de PK são preservados na FK.

## Persistência

Crie primeiro a entidade alvo e passe a entidade carregada na propriedade da
relação ao persistir a entidade que referencia:

```ts
const profileKey = await profiles.create({ bio: 'Maintainer' });
const profile = await profiles.findById(profileKey);
if (!profile) throw new Error('Profile not found');

await users.create({ profile });
await users.create({}); // `profile_id` recebe NULL porque a relação é opcional.
```

`Repository.create()` e `Repository.update()` copiam cada propriedade de chave
primária da entidade relacionada para suas colunas de FK. Consultas não carregam
a entidade relacionada automaticamente; use o repositório dela quando precisar
dos seus dados.
