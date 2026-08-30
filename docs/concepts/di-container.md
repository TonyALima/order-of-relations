# Dependency Injection Container

> **Ainda não implementado.** O código em `src/` não tem `Container`, `@Service`, `@Inject` nem
> `@InjectRepository`. Os exemplos atuais usam construção direta
> (`new Repository(User, db)`). Esta página descreve o design pretendido — ver a nota de
> implementação na [ADR 0003](../decisions/0003-singleton-di-container.md).

## Definição

Um **container de DI** é um objeto que é dono de instâncias de serviço e resolve suas
dependências sob demanda. No OOR, o `Container` é um singleton guardando singletons de serviço.
`@Service` registra um construtor; `@Inject` e `@InjectRepository` marcam campos a preencher
quando o serviço é resolvido.

O container do OOR é intencionalmente mínimo: escopo único (singleton), sem resolução assíncrona,
sem hooks de ciclo de vida. Seu trabalho é uma coisa só — tornar a injeção de `Repository<T>`
ergonômica.

## Como funciona (design pretendido)

- `@Service` decora uma classe. Em tempo de avaliação da classe, o decorator registra o
  construtor no registry do container, sob a própria classe como token.
- `@Inject(SomeService)` decora um campo. Quando o container resolve a classe dona, procura
  `SomeService` no registry, instancia uma vez (ou retorna a instância cacheada) e atribui ao
  campo.
- `@InjectRepository(EntityClass)` é uma especialização que resolve o
  `Repository<EntityClass>` daquela entidade, de novo a partir de um cache singleton chaveado
  pelo construtor da entidade.

Como tudo tem escopo singleton, grafos de instância são idênticos para todo consumidor no mesmo
processo.

## Por que importa

- **Repositórios sem cerimônia.** Um serviço anota um campo e recebe um `Repository<T>` ligado.
  Sem factory function, sem `new` manual.
- **Testes podem trocar.** Testes registram uma implementação fake antes de resolver o serviço
  sob teste, substituindo o `Repository<T>` real por um stub.
- **Escopo limitado.** Como o container faz *apenas* wiring de repositórios, ele permanece
  pequeno o suficiente para ler e raciocinar sobre. O risco que absorve é "um container de 30
  linhas", não "uma config de Inversify".

## Exemplos (aspiracional)

```ts
@Service
class UserService {
  @InjectRepository(User)
  private users!: Repository<User>;

  @Inject(EmailGateway)
  private email!: EmailGateway;

  async invite(email: string) {
    const user = await this.users.create({ email });
    await this.email.send(user, 'welcome');
  }
}

// Em algum lugar do startup:
const userService = container.get(UserService);
```

## Conexões

- [ADR 0003](../decisions/0003-singleton-di-container.md) — a decisão que fixa escopo e intenção.
- [repository-pattern.md](repository-pattern.md) — a coisa principal que o container existe para
  ligar.
