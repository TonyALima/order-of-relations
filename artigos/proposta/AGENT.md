# CLAUDE.md

> Este repositório é redigido em **português do Brasil** (registro acadêmico). Mantenha o conteúdo, comentários e respostas em PT-BR. Termos técnicos próprios (decorators, Repository, Stage-3, Bun, ORM) permanecem em inglês.

## Memória — escrever só com permissão explícita

**NÃO** crie nem atualize arquivos no store de memória (`~/.claude/projects/<este-projeto>/memory/`) sem **permissão explícita do usuário**. Não salve memórias proativamente: se algo parecer digno de registro, **pergunte antes**. Regra válida para qualquer agente que atue neste projeto.

## Fluxo de redação — propor antes de escrever (OBRIGATÓRIO)

Antes de **criar ou editar qualquer conteúdo redacional** das seções (`sections/*.tex`) ou do `referencias.bib`, **proponha primeiro**: estrutura mais o texto proposto, e **espere a confirmação explícita do usuário** ("pode escrever", "aplique", "pode aplicar").

- Um ajuste, um elogio ou um "gostei" **não** é sinal verde para escrever — só vale o aval explícito de aplicar.
- A proposta deve mostrar o **texto integral** que entraria no documento (não um resumo da intenção), além de onde entra e quais `\cite`/entradas `.bib` envolve.
- Se o usuário pedir ajustes, **reproponha** o texto revisado e espere de novo.
- O texto deve **se sustentar sozinho**: nunca embuta nele o feedback ou a pergunta do usuário (ex.: "dois critérios pedem definição") — o leitor não conhece o pedido; apresente os conceitos de forma natural.
- Registro **denso, porém nem prolixo nem hipertécnico**: corte mecanismo de implementação que não serve ao "o quê" (ver altitude conceitual, decisão 1 do `HANDOFF.md`).
- **Exceção:** correções triviais e objetivas (typo, concordância, `\cite` quebrado, formatação) podem ir direto.

Vale para **qualquer agente** neste projeto. (Memória: `confirm-before-writing`.)

## O que é este repositório

Documento **LaTeX** com o **plano de trabalho + revisão bibliográfica do TCC1** do aluno **Tony Albert Lima (ECO — Engenharia de Computação, UNIFEI)**, orientado por **Enzo Seraphim**. Título: **"Metaprogramação em TypeScript para Mapeamento Objeto-Relacional"**. É a proposta enviada à **banca de TCC01** para análise e deliberação — **não é o TCC em si**, mas o planejamento dele.

Na UNIFEI o TCC é dividido em duas fases: **TCC1** (este documento: plano + revisão) e **TCC2** (execução). A seção de cronograma aqui descreve as atividades planejadas para o **TCC02**.

## O assunto do TCC, em um parágrafo

**Order of Relations (OOR)** é um **ORM opinativo para PostgreSQL escrito em TypeScript**, que serve simultaneamente como TCC e como pacote npm publicável. Usa **decorators ECMAScript Stage-3** (`@Entity`, `@Column`, `@PrimaryColumn`, `@ToOne`, `@Nullable`) para declarar entidades, sem `reflect-metadata` — a metadata vive num `MetadataStorage` por `Database`. Segue o **Data Mapper Pattern** em camadas com dependências só "para baixo": decorators → metadata → `Repository<T>` (entrada de persistência) → `QueryBuilder<T>` lazy → driver SQL do **Bun** → PostgreSQL. Princípios inegociáveis: **SQL sempre parametrizado** (`sql.unsafe` é proibido), **sem `any`** (API type-driven, com brand `PrimaryKey<V>` para exigir chaves em tempo de compilação) e **toolchain único: Bun** (runtime, testes, bundler). Suporta **herança de tabela única (STI)** via coluna discriminadora. O ângulo acadêmico central é **metaprogramação**: decorators + programação em nível de tipos + metadata em runtime aplicados ao mapeamento objeto-relacional.

## Compilação

**Engine obrigatório: LuaLaTeX.** O preâmbulo usa `fontspec` + `\setmainfont{Arial}` e o comentário em `main.tex:47` exige LuaTeX (`RawFeature=+tnum` para numerais tabulares). **`pdflatex` falha** — os pacotes `cmap`/`inputenc`/`times` no topo são resíduos de pdfLaTeX e ficam inertes sob LuaLaTeX (mantenha `inputenc` comentado: a fonte é UTF-8 nativa).

Build completo (TOC + bibliografia IEEEtran a partir de `referencias.bib`):

```bash
latexmk -lualatex main.tex        # forma recomendada (resolve TOC e .bib automaticamente)
# ou, manualmente:
lualatex main.tex && bibtex main && lualatex main.tex && lualatex main.tex
```

Saída: `main.pdf`.

> **Toolchain local ausente** (verificado em 2026-06: `lualatex`, `xelatex`, `pdflatex`, `latexmk`, `bibtex` não instalados). O `main.pdf` existente foi gerado em outro ambiente — provavelmente **Overleaf**. Para compilar localmente, instale o **MacTeX/TeX Live**. A fonte **Arial já existe no macOS** (`/System/Library/Fonts/Supplemental/Arial.ttf`), então `\setmainfont{Arial}` resolve assim que um engine com fontspec estiver disponível.

## Estrutura do documento

`main.tex` é o mestre (apenas preâmbulo + `\input`s). **Edite o conteúdo nos arquivos de `sections/`, não em `main.tex`.** Ordem de inclusão:

1. `sections/title.tex` — capa (logo UNIFEI, título, aluno, orientador)
2. `sections/01-introducao.tex`
3. `sections/02-motivacao.tex`
4. `sections/03-revisao.tex` — Revisão bibliográfica
5. `sections/04-objetivos.tex` — Objetivos específicos
6. `sections/05-materiais_e_metodos.tex`
7. `sections/06-resultados.tex` — Resultados esperados
8. `sections/07-cronograma.tex` — Cronograma do TCC02 (tabela `longtable` + gráfico `pgfgantt`)
9. Referências — `\bibliographystyle{IEEEtran}` sobre `referencias.bib`

Outros: `img/` (logo da UNIFEI) · `referencias.bib` (BibTeX, estilo IEEEtran).

## Restrições obrigatórias da banca (NÃO violar)

Especificadas no cabeçalho de `main.tex:1-5` e já codificadas no preâmbulo. Cada item está marcado `OK` lá:

- **A4**; margens: **superior 1,5 cm**, inferior 2,5 cm, esquerda e direita 2,0 cm (já em `geometry`: `top=15mm,bottom=25mm,left=20mm,right=20mm`).
- Parágrafos: **0 pt antes, 6 pt depois, entrelinhas 1,5** (`\onehalfspacing` + `\parskip 0.6em`).
- **Títulos/subtítulos: Arial 12, negrito, à esquerda** (`\titleformat*{...}{\large\bfseries}`).
- **Corpo: Arial 10, sem negrito, justificado** (`documentclass[10pt]` + `\setmainfont{Arial}`).

Antes de entregar, compile e **confirme a formatação** (A4, margens, fontes).

## Estado atual

Atualizado em 2026-06-18. Para o detalhe por seção, as decisões editoriais e a tabela de referências, veja o **`HANDOFF.md`**.

**Seções `01`–`05` escritas** (Introdução, Motivação, Revisão, Objetivos, Materiais e Métodos), com conteúdo real (não mais texto-modelo). **Pendentes:**

- `06` Resultados esperados — ainda **texto-modelo**.
- `07` Cronograma — ainda **placeholders** (`F.0`/`F.1`, "Atividade 01", datas de 2025 no gráfico Gantt); é o cronograma do **TCC02**.

O **`referencias.bib`** tem **15 entradas** (IEEEtran), não está mais vazio. Ao citar algo novo, adicionar a entrada e **manter a paridade `\cite`↔`.bib`**.

Ao redigir o que falta, puxar fatos do vault e do código (**não inventar**):

- **Resultados** ← `questions/` e escopo no `overview.md`.
- **Cronograma** ← fases/atividades reais do TCC02 e correção das datas do `ganttchart`.
- (Revisão e Materiais/Métodos, já escritas, foram fundamentadas em `comparisons/`, `sources/`, `decisions/`, `concepts/`, no stack real `../order-of-relations` e em fontes externas — Fowler/PoEAA, OpenJPA, TC39, papers — ver `HANDOFF.md` §4.)

## Convenções e detalhes do preâmbulo

- **Notas de revisão**: comandos `todonotes` customizados disponíveis — `\todoin`, `\todogeg` (amarelo), `\todovwcm` (vermelho). `\listoftodos` está comentado em `main.tex:114`; descomente para listar pendências.
- **Modo P&B**: `\blackandwhitetrue` está ativo — afeta `\cheading`/`\highest` (sem cor). Há um ramo colorido (Maroon) caso desligue.
- **Estilo de bibliografia**: `IEEEtran` (ativo). Existe `abntex2-alf` comentado como alternativa ABNT, caso a banca prefira.
- **Não migre para pdfLaTeX**: quebra `fontspec`/Arial. Mantenha o fluxo LuaLaTeX e a fonte em UTF-8.
- **É um repositório git** (commits assinados por GPG; em geral o **usuário** mesmo faz os commits — ver `HANDOFF.md`). Não há scripts de build próprios (Makefile/latexmkrc) — a compilação é manual via os comandos acima.
