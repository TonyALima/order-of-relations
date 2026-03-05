# order-of-relations

TypeScript ORM library. Uses ECMAScript Stage-3 decorators for entity mapping, with a fluent query builder, DI container, transaction support, and schema-based migrations.

## Installation

```bash
bun install
```

## Decorators

| Decorator                       | Description                           |
| ------------------------------- | ------------------------------------- |
| `@Entity`                       | Maps a class to a database table      |
| `@PrimaryColumn`                | Auto-increment primary key (`serial`) |
| `@Column`                       | Maps a class property to a column     |
| `@ManyToOne` / `@OneToMany`     | Relation decorators                   |
| `@Service`                      | Registers a class in the DI container |
| `@Inject` / `@InjectRepository` | Injects dependencies into services    |

## Column Types (`@Column({ type })`)

| TypeScript intent | `type` value                              |
| ----------------- | ----------------------------------------- |
| auto-increment PK | `'serial'` (default for `@PrimaryColumn`) |
| integer           | `'integer'`                               |
| text              | `'text'` (default for `@Column`)          |
| boolean           | `'boolean'`                               |
| timestamp         | `'timestamp'`                             |

## Usage

```ts
@Entity('users')
class User {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;
}

const id = await userRepository.create({ name: 'Alice' });
const user = await userRepository.findOne(id);
```
