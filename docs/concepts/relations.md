# Relações (`@ToOne` e o thunk de alvo)

## Definição

No OOR, `@ToOne` (e qualquer futuro decorator de relação) declara sua entidade alvo como uma
**closure que retorna o construtor** — um *thunk* — em vez de uma referência direta:

```ts
@ToOne(() => User) // <-- closure
declare author: User;
```

O thunk é guardado em `RelationMetadata` como `getTarget()`. A resolução o chama depois, quando
todas as classes já foram carregadas.

## Como funciona

Uma referência direta ao construtor em tempo de decoração falha em grafos circulares de entidades
por causa da **temporal dead zone (TDZ)** do JavaScript:

```ts
@Entity(db)
class Post {
  @ToOne(User) // <-- ReferenceError se User ainda não foi declarada
  declare author: User;
}

@Entity(db)
class User {
  /* ... */
}
```

O decorator em `Post.author` roda quando a classe `Post` é avaliada — *antes* da declaração de
`User` ter executado. Ler `User` aqui lança exceção.

Uma closure desvia da TDZ:

```ts
@ToOne(() => User);
```

A referência a `User` agora está dentro do corpo de uma função, avaliada só quando a função é
chamada. A resolução acontece depois — especificamente, durante a passagem de resolução de
relações do [MetadataStorage](../components/metadata-storage.md), após todos os `@Entity` terem
rodado.

## Por que importa

- **Grafos circulares viram triviais.** `User` tem muitos `Post`; cada `Post` pertence a um
  `User`. Ambas as direções podem se referenciar em tempo de decoração sem restrições de ordem.
- **Referências para frente funcionam.** Uma relação pode mirar uma classe ainda não declarada.
  Contanto que ela *seja* declarada (e decorada) até a resolução do storage rodar, o thunk
  funciona.
- **Sem lookup por string.** Alguns ORMs usam `@ToOne('User')` para desviar do mesmo problema de
  TDZ, e depois resolvem a string contra um registro de nomes. A abordagem de thunk mantém tudo
  type-safe — o TypeScript verifica o corpo da closure — sem sacrificar a resolução adiada.

## Quando o thunk é chamado

Dentro da passagem `resolveRelations` do MetadataStorage:

1. Para cada `RelationMetadata` no storage, invoca `getTarget()`.
2. Procura o construtor retornado no `Map` do storage.
3. Se encontrado, preenche os nomes das colunas FK (`<propriedade>_<pkDoAlvo>`) e os **tipos**
   das colunas FK, derivados chamando `toForeignKeyType(pk.type)` em cada coluna primária do
   alvo. SERIAL/SMALLSERIAL/BIGSERIAL são rebaixados para os tipos inteiros subjacentes, para que
   a FK não reivindique uma sequence própria — ver
   [components/sql-types.md](../components/sql-types.md).
4. Se **não** encontrado (o alvo nunca foi registrado com `@Entity`), lança
   `RelationTargetNotFoundError` com o nome da classe alvo e o caminho da relação na origem (ex.:
   `posts.author`).

Este é o modo de falha canônico de "esqueci de importar a entidade relacionada, então o decorator
dela nunca rodou" — pego na primeira leitura do storage, com contexto suficiente para diagnosticar.

## Armadilhas

- **A closure precisa capturar o construtor por referência**, não por valor. `@ToOne(() => User)`
  funciona; `(() => 'User')` não — o resolvedor compara construtores por identidade.
- **A resolução lazy adia o erro.** Um alvo com typo não falha em tempo de decoração; falha na
  primeira `db.getMetadata().get(...)` após o registro da relação. A maioria do código de usuário
  dispara essa leitura cedo o bastante para o adiamento ser invisível.
- **O thunk roda uma vez por passagem de resolução.** Efeitos colaterais no corpo da closure
  (não coloque nenhum) disparariam repetidamente se a flag de resolução fosse resetada por um
  `set()` tardio.

## Estado atual das relações

`RelationType.TO_ONE` é o único tipo de relação implementado; `TO_MANY` existe no enum, mas sem
implementação — ver [questions/support-one-to-many.md](../questions/support-one-to-many.md) e
[questions/support-many-to-many.md](../questions/support-many-to-many.md). O carregamento de
relações em leitura (joins / eager loading) também é trabalho futuro; hoje as leituras projetam
apenas as colunas da própria tabela.

## Conexões

- [MetadataStorage](../components/metadata-storage.md) — chama o thunk durante a resolução de
  relações; lança `RelationTargetNotFoundError` em caso de miss.
- [stage-3-decorators.md](stage-3-decorators.md) — a semântica de linguagem que torna a TDZ um
  problema real em tempo de decoração.
- [components/sql-types.md](../components/sql-types.md) — o rebaixamento de tipo FK.
