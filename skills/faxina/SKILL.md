---
name: faxina
description: Use quando o usuário pedir para limpar worktrees e branches git criadas para implementar um PR, normalmente depois que o PR foi merged. Remove a worktree, a branch local e a branch remota.
---

# Faxina (limpeza de worktree e branch)

## Visão geral

Este skill limpa os artefatos git criados durante a implementação de um PR (via skill
`implemente`): a **worktree**, a **branch local** e a **branch remota**. Deve ser chamado
**depois que o PR foi merged**.

## Pré-condição

- O PR correspondente já foi **merged** (ou o usuário confirmou que pode remover).
- Se o PR ainda não foi merged, **não** remova a branch — avise o usuário antes de prosseguir.

## Fluxo obrigatório

### 1. Identificar a worktree e a branch

Liste as worktrees e branches existentes para localizar a que corresponde ao PR:

```bash
git worktree list
git branch -a
```

Identifique a worktree/branch pelo nome (ex.: `feat/implement-skill`) ou pelo PR associado.

### 2. Confirmar que o PR foi merged

Verifique se a branch já foi incorporada à `main`:

```bash
git fetch origin
git branch -r --merged origin/main
```

Se a branch remota não aparecer na lista de merged, **pare** e informe o usuário — não
remova uma branch cujo PR ainda não foi mergeado.

### 3. Remover a worktree

```bash
git worktree remove <caminho-da-worktree>
```

Se a worktree tiver alterações não commitadas, use `--force` apenas com confirmação
explícita do usuário.

### 4. Remover a branch local

```bash
git branch -d <branch>
```

Use `-d` (delete apenas se merged). Se falhar por não estar merged, reavalie antes de
usar `-D`.

### 5. Remover a branch remota

```bash
git push origin --delete <branch>
```

### 6. Limpar referências órfãs (opcional)

```bash
git worktree prune
git fetch --prune
```

## Regras

- **Nunca** remova a branch `main` nem o checkout atual.
- **Nunca** remova uma branch cujo PR ainda não foi merged — confirme antes.
- Se a worktree tiver alterações não commitadas, não as descarte sem confirmação do usuário.
- Ao final, confirme ao usuário o que foi removido (worktree, branch local e remota).
