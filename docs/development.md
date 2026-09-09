# Guia de desenvolvimento

Este guia descreve como preparar o ambiente local e contribuir com `order-of-relations`.
Para uma introdução à biblioteca e exemplos de uso, consulte o [README](../README.md).

## Pré-requisitos

- [Bun](https://bun.sh/) 1.3 ou superior;
- PostgreSQL em execução e acessível localmente;
- Git.

O projeto é uma biblioteca TypeScript para PostgreSQL. Não há servidor de desenvolvimento
ou outro processo persistente para iniciar.

## Preparar o ambiente

Instale as dependências na raiz do repositório:

```bash
bun install
```

Crie um banco local de desenvolvimento, caso ainda não exista:

```bash
createdb order_of_relations
```

Copie o exemplo de configuração e substitua apenas os valores necessários para a sua
instalação local. O Bun carrega `.env` automaticamente.

```bash
cp .env.example .env
```

`DATABASE_URL` deve apontar para o banco criado:

```env
DATABASE_URL=postgres://usuario:senha@localhost:5432/order_of_relations
```

Não inclua credenciais reais no repositório. O arquivo `.env` é local e está no
`.gitignore`; mantenha `.env.example` apenas com valores de exemplo.

### Banco de dados, esquema e dados de exemplo

O projeto não possui ferramenta de migrations nem seeds. O esquema é definido pelos
decoradores das entidades e criado em código com `Database.create()`.

Os exemplos recriam as próprias tabelas com `Database.drop()` e `Database.create()`.
Use-os somente com o banco de desenvolvimento configurado acima:

```bash
bun examples/basic-crud/index.ts
bun examples/inheritance/index.ts
```

## Estrutura do repositório

```text
src/                    implementação pública da biblioteca
  core/                  banco, metadados, repositórios e tipos SQL
  decorators/            decoradores de entidades, colunas e relações
  query-builder/         construção de consultas tipadas
tests/                   testes de integração com PostgreSQL
examples/                fluxos executáveis de CRUD e herança
docs/                    documentação do projeto
```

Para a explicação arquitetural, consulte a [arquitetura](architecture.md); o
[diagrama de classes](class-diagram.md) apresenta as relações entre os componentes.
As convenções para comentários e TSDoc estão em
[Documentação no código](code-documentation.md).

## Fluxo de desenvolvimento

1. Atualize sua cópia de `main` e crie uma branch focada na alteração. Por exemplo:

   ```bash
   git switch main
   git pull --ff-only
   git switch -c docs/minha-alteracao
   ```

2. Faça a alteração e atualize a documentação, os exemplos e os testes quando o
   comportamento público for afetado.
3. Durante o trabalho, execute a suíte em modo de observação:

   ```bash
   bun test --watch
   ```

4. Antes de enviar a alteração, execute todas as verificações da seção seguinte.
5. Faça commits pequenos e descritivos. O histórico usa o formato
   `<tipo>: <descrição>`, como `docs: atualizar guia de desenvolvimento` e
   `fix: corrigir relação opcional`.
6. Abra um pull request descrevendo a mudança, os testes executados e qualquer
   impacto no banco. A alteração deve passar por revisão antes da mesclagem.

## Verificações de qualidade

Execute estes comandos na raiz do repositório antes de abrir um pull request:

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

Para formatar arquivos, use:

```bash
bun run format
```

`bun run format` altera os arquivos formatados; revise essas alterações antes de
incluí-las no commit. Os testes de integração precisam de `DATABASE_URL` apontando
para o banco de desenvolvimento.

## Troubleshooting

### Falha ao conectar ao PostgreSQL

Confirme que o serviço PostgreSQL está em execução e que `DATABASE_URL` em `.env`
aponta para um banco acessível. Substitua a URL abaixo pelo valor configurado para
conferir a conexão:

```bash
psql 'postgres://usuario:senha@localhost:5432/order_of_relations' -c 'SELECT 1'
```

### As tabelas do exemplo desapareceram ou foram recriadas

Os exemplos chamam `Database.drop()` antes de criar o esquema. Configure
`DATABASE_URL` para um banco descartável, nunca para um banco com dados importantes.
