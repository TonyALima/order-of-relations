# Connection Pooling

Um connection pool é um conjunto limitado de conexões de banco pré-estabelecidas que a aplicação
reutiliza entre muitas requisições. Sem pooling, toda query paga o custo de TCP + auth + setup de
sessão de uma conexão nova. Com pooling, esses custos se amortizam ao longo de milhares de
queries.

Para PostgreSQL especificamente: uma conexão backend é um processo de SO via fork. O custo de
setup é real (dezenas de milissegundos), e o custo de memória por conexão é suficiente para que
rodar sem pool esgote os recursos do servidor antes de esgotar a capacidade do cliente.

## Por que importa aqui

O [paper JCSI 2025](../research/orm-frameworks-node-jcsi-2025.md) atribui a dominância do Prisma
sob carga paralela — 50 queries em voo — diretamente à sua implementação de connection pooling,
e não à sua escolha de [padrão Data Mapper](orm-patterns.md). O paper observa:

- Sob cargas sequenciais, o pool fica majoritariamente ocioso — o overhead por chamada do Prisma
  domina e ele perde para o Sequelize.
- Sob concorrência de 50 vias, o pool do Prisma alimenta queries no banco com contenção mínima,
  enquanto o Sequelize (no mesmo benchmark) colapsa em overhead de construção de queries.
- Sob transações, nem o pool do Prisma consegue esconder o custo de formação por transação —
  pooling ajuda *queries* concorrentes, não *transações* concorrentes na mesma conexão.

O aprendizado: **connection pooling é um diferenciador de carga paralela, não uma otimização por
query**.

## Onde vive o pooling do OOR

O OOR **não** implementa connection pooling na camada de ORM. Delega ao driver `SQL` do runtime
Bun, que tem pooling próprio. Isso é intencional:

- O pool é uma preocupação de transporte, não de mapeamento.
- O `SQL` do Bun é o único driver suportado hoje; reimplementar pooling por cima duplicaria
  lógica sem ganho.
- A disciplina de [parameterized SQL](parameterized-sql.md) do OOR significa que toda query
  emitida passa pelo mesmo caminho de driver — o comportamento do pool é uniforme.

A desvantagem em relação ao Prisma é a **falta de superfície de tuning de pool**. O Prisma expõe
connection limit, idle timeout, query timeout etc. como config de primeira classe. O OOR expõe o
que o Bun expõe — hoje, consideravelmente menos.

> **Eixo futuro.** Se o OOR um dia precisar se defender em performance de carga paralela, a
> superfície de tuning de pool é a lacuna mais provável a fechar.

## Conexões

- [research/orm-frameworks-node-jcsi-2025.md](../research/orm-frameworks-node-jcsi-2025.md) — o
  benchmark em que pooling se mostrou decisivo sob carga paralela.
