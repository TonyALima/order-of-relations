# Analysis of ORM framework approaches for Node.js (JCSI 37, 2025)

## Citação

S. Zhadko-Bazilevych, *Analysis of ORM framework approaches for Node.js*, **Journal of Computer
Sciences Institute** 37 (2025) 426–430. Recebido em 18/06/2025, aceito em 19/08/2025. Publicado
sob CC BY 4.0. Autor: Department of Computer Science, Kharkiv National University of
Radioelectronics (Kharkiv, Ucrânia).

Fonte: PDF em `.raw/orm-frameworks-node-jcsi-2025.pdf` (no vault Obsidian).

## O que o paper é

Um benchmark controlado de três ORMs Node.js — **Sequelize**, **Prisma**, **TypeORM** — rodando
contra o mesmo backend PostgreSQL por trás de uma aplicação NestJS. Nove endpoints simulam uma
pequena loja online (usuários, perfis, categorias, produtos, pedidos, itens de pedido,
comentários). Cada endpoint é implementado três vezes — uma por ORM — e exercitado sob três
modos de carga:

1. **Single cached** — sequencial, cache do PG quente.
2. **Single uncached** — sequencial, cache do PG limpo entre chamadas.
3. **Parallel (50)** — 50 queries em voo, repostas conforme cada uma completa.

1.000 queries por combinação (endpoint × ORM × modo). O banco foi semeado com 5M+ linhas (300 mil
usuários, 600 mil produtos, 600 mil pedidos, 1,8M itens de pedido). Servidor (`node:18-alpine`) e
banco (`postgres:latest`, Debian) em containers Docker separados. Hardware: Intel Core i5-8265U,
16 GB DDR4, 256 GB SSD.

O autor registra o SQL cru que cada ORM emite e então roda `EXPLAIN (ANALYZE)` no PostgreSQL para
separar **overhead de ORM** (construção da query + desserialização do resultado) do **tempo de
execução do PostgreSQL**.

## Por que importa para o OOR

O OOR é um quarto ORM Node.js para PostgreSQL — explicitamente posicionado contra esses três. O
paper **não** inclui o OOR (é um TCC; ainda não está no campo), mas entrega:

- Um artefato externo e citável de **como o campo se comporta empiricamente**, não só
  arquiteturalmente.
- **Estratégias de emissão de query** por ORM para leituras não triviais (dados aninhados,
  transações, árvores) — escolhas que o OOR vai enfrentar ao crescer.
- Uma **metodologia reproduzível** que o TCC pode estender se a tese um dia precisar de números
  OOR-vs-concorrentes.

## Achados de manchete

- **Prisma** vence em carga paralela; perde em single uncached. O
  [Data Mapper](../concepts/orm-patterns.md) + connection pooling agressivo o carregam sob
  concorrência.
- **Sequelize** vence em operações simples (cached e uncached). O
  [Active Record](../concepts/orm-patterns.md) mantém o SQL compacto, mas a mesma compacidade
  colapsa sob carga paralela.
- **TypeORM** é o mais equilibrado entre modos; perde em transações e no endpoint de leitura
  aninhada por causa da sua estratégia de dedup por subquery. Único ORM com
  [modelos hierárquicos](../concepts/hierarchical-data-models.md) avançados embutidos (Closure
  Table, Nested Set, Materialized Path) além do Adjacency List puro.

## Os nove endpoints

Os quatro primeiros são CRUD puro; o resto exercita os casos difíceis.

| # | Endpoint | Forma | Contraste-chave |
| --- | --- | --- | --- |
| 1 | Ler dados do usuário | `SELECT ... WHERE id = ?` | Sequelize ≈ TypeORM com cache; Prisma ~30% mais lento cached, ~3× mais lento uncached, mais rápido em paralelo. |
| 2 | Criar usuário | `INSERT` | Sequelize mais rápido cached (geração compacta). Todos os ORMs *mais rápidos* em paralelo que em single-cached — overhead de pool de conexões + dispatch assíncrono amortiza. |
| 3 | Atualizar usuário | `UPDATE` | Os três aproximadamente iguais cached; TypeORM produz SQL menos ótimo sob carga uncached. Paralelo ≈ cached. |
| 4 | Deletar usuário | `DELETE` | Efetivamente empate em todos os modos; Prisma leva o paralelo por pouco. |
| 5 | Listar produtos | `SELECT` com filtro / ordenação / paginação | Cached: TypeORM ≈ Sequelize, Prisma ~30% mais lento. Uncached: >90% do tempo é do lado do banco, então o diferenciador é geração de query + transporte. Prisma mais fraco. Paralelo: Prisma mais rápido, Sequelize mais lento. |
| 6 | Ler dados do pedido | Pedido + itens (aninhado) | **Três estratégias de SQL diferentes** — ver abaixo. A subquery do TypeORM lhe custa em todo modo. |
| 7 | Criar pedido | Insert em múltiplas tabelas | Sequelize significativamente mais lento em cached / paralelo; empata com TypeORM em uncached. |
| 8 | Confirmar pedido | Transação em múltiplos passos | A maior parte do tempo vai para **formação da transação**, não execução das queries. A estabilidade típica do Prisma em carga paralela quebra aqui. TypeORM mais fraco, atribuído ao tempo de geração do SQL cru. |
| 9 | Árvore de comentários | Leitura recursiva sobre Adjacency List | Todos similares (limitados por leitura). TypeORM é o único que pode cair para modelos de árvore mais ricos se Adjacency List for o encaixe errado. |

> **O que o paper NÃO reporta:** números exatos em milissegundos (o artigo mostra gráficos de
> barra, não tabelas — as alegações são relativas: "30% mais longo", "três vezes mais lento",
> "comparável"); footprint de memória ou CPU; comportamento em versões de PG diferentes de
> `postgres:latest`; custo de cold-start; qualquer ORM fora do trio (**sem OOR, sem Drizzle, sem
> Knex/Objection**).

## Endpoint 6: as estratégias de leitura aninhada (achado de maior sinal para o OOR)

Para "Pedido + seus itens", os três ORMs emitem SQL fundamentalmente diferente:

- **Sequelize** — um statement com `LEFT OUTER JOIN`. A duplicação de linhas é remontada no
  código da aplicação.
- **Prisma** — dois statements sequenciais (um por tabela), costurados no código da aplicação.
- **TypeORM** — statement único, mas usa uma **subquery aninhada** para evitar a duplicação de
  linhas inerente à abordagem LEFT JOIN.

A subquery do TypeORM lhe custa: em todo modo (cached, uncached, paralelo), ela tem o maior tempo
de execução de SQL *e* o maior tempo de geração/transporte (exceto onde a lentidão uncached do
Prisma o supera). É a demonstração mais limpa do paper de que **qual forma de SQL o ORM emite é
pelo menos tão importante quanto qual padrão arquitetural ele implementa**.

> **Relevância direta para o OOR.** O OOR ainda não se comprometeu com uma estratégia de SQL para
> leituras aninhadas. A decisão está aberta e é estrutural — ver
> [questions/support-one-to-many.md](../questions/support-one-to-many.md), onde uma estratégia de
> leitura aninhada se tornará inevitável.

## Endpoint 8: transações dominam, não o custo por query

O endpoint "Confirmar pedido" é uma transação de três passos (atualizar status → selecionar itens
→ decrementar estoque). Nos três ORMs, a **maioria dos recursos vai para formação e gerenciamento
da transação**, não para as queries constituintes. A vantagem de connection pool do Prisma evapora
aqui. O overhead do TypeORM está na etapa de geração do SQL cru, não no banco.

Achado relevante para a tese: num backend real, transações são comuns, e os benchmarks por query
exibidos no site de marketing de todo ORM descrevem mal a experiência.

## Endpoint 9: árvores e o teto do Adjacency List

O paper usa **Adjacency List** (`parent_id` na linha) para a árvore de comentários porque é o que
os três ORMs suportam nativamente. Ler a árvore significa consultar descendentes recursivamente.
Os números são limitados por leitura e similares entre os três.

O paper fecha a seção com a **vantagem única do TypeORM**: ele entrega suporte de primeira classe
a Closure Table, Nested Set e Materialized Path (ver
[concepts/hierarchical-data-models.md](../concepts/hierarchical-data-models.md)). Esses dão
melhor eficiência de query em hierarquias profundas / frequentemente acessadas, a custo de
complexidade de escrita. Sequelize e Prisma exigem implementação manual; TypeORM tem decorators.

> **Posição do OOR:** sem suporte a árvores hoje. Se o TCC um dia precisar defender essa
> ausência, este paper é a citação natural: documenta tanto o baseline Adjacency List quanto as
> alternativas mais avançadas que o TypeORM possui.

## Conclusões transversais

1. **Padrão arquitetural não é destino.** Sequelize (Active Record) vence ops simples; TypeORM
   (AR + Data Mapper) é o mais equilibrado; Prisma (DM puro) vence em paralelo. O rótulo do
   padrão prevê *parte* do comportamento, mas não a maioria.
2. **Connection pooling é o diferenciador de carga paralela.** A dominância do Prisma sob
   concorrência de 50 vias é atribuída à sua implementação de pooling, não ao seu padrão DM. Ver
   [concepts/connection-pooling.md](../concepts/connection-pooling.md) — relevante mesmo o
   pooling do OOR vivendo hoje na camada do driver `SQL` do Bun, não na camada de ORM.
3. **A forma do SQL emitido pode superar o padrão.** A dedup por subquery do TypeORM em leituras
   aninhadas, o INSERT compacto do Sequelize, a costura de duas queries do Prisma — cada um é uma
   **escolha de forma** na camada de ORM que atropela qualquer vantagem em nível de padrão.
4. **Transações são onde mora o imposto do ORM.** O endpoint 8 mostra a formação de transação
   dominando o custo. Nenhum dos três ORMs a torna barata.
5. **Árvores expõem a cauda longa.** Os decorators hierárquicos do TypeORM são a feature mais
   defensável que ele tem sobre qualquer concorrente.

## Referências do paper

1. Barnes (2007) — ORM como mecanismo de persistência (tese Macalester).
2. Documentação do Sequelize — <https://sequelize.org/docs/v6/>
3. Documentação do Prisma — <https://www.prisma.io/docs/orm>
4. Documentação do TypeORM — <https://typeorm.io/docs/>
5. Bäcke & Lindström (2024) — avaliação mais ampla de ORMs, dissertação Linnaeus (o prior art
   mais próximo; o paper JCSI deliberadamente estreita o escopo para só performance).
6. Documentação do NestJS — <https://docs.nestjs.com/>
7. PostgreSQL `EXPLAIN` — <https://www.postgresql.org/docs/17/sql-explain.html>
8. Boettiger (2015) — Docker para pesquisa reproduzível.
9. Mishra & Eich (1992) — processamento de joins em bancos relacionais.
10. Novotný & Wild (2024) — modelagem de estruturas hierárquicas em bancos de biodiversidade.

## Páginas relacionadas

- [concepts/orm-patterns.md](../concepts/orm-patterns.md) — Active Record vs. Data Mapper, com os
  perfis empíricos deste paper.
- [concepts/hierarchical-data-models.md](../concepts/hierarchical-data-models.md) — as quatro
  estratégias de modelagem de árvore.
- [concepts/connection-pooling.md](../concepts/connection-pooling.md) — pooling como
  diferenciador de carga paralela.
- [comparisons/orms-summary.md](../comparisons/orms-summary.md) — a matriz de features.
