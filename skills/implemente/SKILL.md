---
name: implemente
description: Use quando o usuário pedir para implementar uma solução para um problema, issue, bug ou feature. Recebe como input a descrição do problema/issue e instrui o agente a implementar em uma nova worktree e branch, validar o código e entregar um Pull Request aberto.
---

# Implemente (worktree + branch + PR)

## Visão geral

Este skill transforma um problema/issue em um Pull Request pronto para revisão. O fluxo
isola o trabalho em uma **worktree git separada** e em uma **branch própria**, para nunca
sujar a branch `main` nem o checkout atual. Ao final, o PR é aberto no GitHub.

## Input

O usuário fornece a descrição de um problema, issue, bug ou feature. Pode vir como texto
livre, número de issue, ou link. Se faltar contexto, use o que estiver disponível e
assuma o comportamento mais razoável — não trave pedindo detalhes que não são bloqueantes.

## Fluxo obrigatório

### 1. Entender o problema

- Leia a descrição do problema/issue.
- Localize os arquivos e símbolos relevantes no código atual.
- Consulte `AGENT.md` se precisar de contexto arquitetural ou de convenções do projeto.

### 2. Criar a worktree e a branch

A partir da branch `main` atualizada, crie uma worktree isolada e uma branch descritiva:

```bash
git fetch origin
git worktree add -b <tipo>/<descricao-curta> ../<nome-worktree> origin/main
```

- `<tipo>` segue a convenção do repo: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`.
- `<descricao-curta>` em kebab-case, ex.: `fix/to-one-name`.
- `<nome-worktree>` é um diretório irmão do repo (ex.: `../order-of-relations-<branch>`).
- **Todo o trabalho de implementação acontece DENTRO da worktree**, nunca no checkout atual.
- Copie o arquivo `.env` do checkout atual para a nova worktree, para que o ambiente
  (variáveis de ambiente, credenciais locais) funcione dentro dela:

```bash
cp .env ../<nome-worktree>/.env
```

  Se o `.env` não existir no checkout atual, pule este passo.

### 3. Implementar (TDD)

Siga as convenções do projeto (ver `AGENT.md`):

### 4. Validar

Rode todas as verificações dentro da worktree antes de commitar:

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

Tudo precisa passar. Se algo falhar, corrija antes de prosseguir.

### 5. Commitar

Faça commits atômicos e descritivos, seguindo o estilo do histórico do repo
(ex.: `fix(relation): rename interface and parameter for clarity`).

### 6. Publicar a branch

```bash
git push -u origin <branch>
```

### 7. Abrir o Pull Request

Abra um PR da branch para `main` no GitHub (via `gh pr create`). O PR deve
conter:

- **Título** descritivo no mesmo estilo dos commits.
- **Descrição** explicando o problema, a solução e como foi validado (testes/typecheck/lint/build).
- Referência à issue original, se houver.

Confirme que o PR foi **aberto** (não apenas criado localmente) e informe a URL ao usuário.

## Regras

- Nunca altere `main` diretamente nem o checkout atual — todo o trabalho é na worktree.
- Se o usuário pedir para parar, pare imediatamente.
