# Tsch-ss-

# Dicionário de Cálculo — API

Backend inicial de um dicionário pesquisável de derivadas, integrais e técnicas
de integração. A interface ainda não faz parte deste projeto: o consumo é por
JSON e as fórmulas são armazenadas em LaTeX.

## Stack

- Node.js 22 e TypeScript
- Fastify para a API HTTP
- PostgreSQL para categorias, fórmulas e referências
- SQL explícito para manter o acesso ao banco simples e verificável

## Executar localmente

1. Copie `.env.example` para `.env`.
2. Inicie o PostgreSQL com `docker compose up -d db` (ou use um servidor PostgreSQL já disponível).
3. Instale as dependências com `npm install`.
4. Crie as tabelas e carregue o catálogo com `npm run db:init`.
5. Inicie a API com `npm run dev`.

O comando `npm run db:init` aplica, em ordem, as migrações SQL ainda pendentes
em `database/migrations/` e atualiza o catálogo inicial. As versões aplicadas
e checksums são registradas em `schema_migrations`; migrações aplicadas não
devem ser editadas — crie uma nova migração para mudanças futuras.

Em bancos criados antes da adoção de migrações, a migração inicial usa
`IF NOT EXISTS` para registrar a estrutura atual sem recriar nem apagar os
dados. O seed permanece idempotente.

### Testar a API sem instalar PostgreSQL nem Docker

Execute `npm run dev:demo` e abra `http://127.0.0.1:3000/api/v1/entries`.
Esse modo inicia um servidor HTTP real com três verbetes demonstrativos em
memória. Ele serve para experimentar o formato JSON e as rotas, mas não conecta
ao banco nem testa o catálogo completo. A resposta de `/health` identifica esse
modo com `"database": "not-configured"`.

## Endpoints

- `GET /health` — verifica a conexão com o banco.
- `GET /api/v1/categories` — lista as categorias.
- `GET /api/v1/entries` — pesquisa com `q`, `kind`, `category`, `limit` e `offset`.
- `GET /api/v1/entries/:slug` — consulta um verbete.

`kind` aceita `derivative`, `integral` ou `technique`. A resposta de pesquisa
contém `data` e `pagination`; cada verbete inclui categoria, condições, notas e
referência bibliográfica. Também expõe aliases, notações, exemplos resolvidos,
aplicações, condições estruturadas, referências relacionadas e relações com
outros verbetes. Os campos anteriores (`conditions` e `source`) permanecem
disponíveis para compatibilidade. A busca textual também considera aliases,
notações, exemplos e aplicações; normaliza diferenças comuns de LaTeX e
Unicode, prioriza correspondências exatas e usa similaridade trigramática para
pequenos erros de digitação. Parâmetros inválidos retornam HTTP 400, e slug
inexistente retorna HTTP 404.

A migração `002_structured_entries.sql` acrescenta essas relações sem remover
ou reescrever os campos legados. As condições em texto e as referências
principais já existentes são copiadas para suas estruturas correspondentes.
O catálogo inicial inclui exemplos explicados para regras da potência e uma
aplicação de derivadas em movimento; conteúdo novo pode ser adicionado sem
alterar o contrato anterior.

A migração `003_search_normalization.sql` habilita `pg_trgm`, cria a função
determinística de normalização matemática e índices para correspondências
aproximadas em títulos, aliases e notações. O PostgreSQL e o modo demo ordenam
resultados por qualidade de correspondência; paginação e total são calculados
por verbete, sem duplicação por aliases/notações.

## Critério para o conteúdo inicial

As fórmulas foram conferidas em seções de cálculo da OpenStax e cada registro
aponta para a seção que sustenta sua fórmula ou técnica. As páginas consultadas
estão sob licença CC BY 4.0; este projeto registra título, editora, licença,
URL e data de consulta para atribuição. As notas são resumos próprios, não cópia
de explicações ou exercícios do livro.

O catálogo inicial cobre regras algébricas, exponenciais e logarítmicas,
trigonométricas, trigonométricas inversas e técnicas comuns (substituição,
integração por partes, integrais trigonométricas, substituição trigonométrica e
frações parciais). Ele é uma primeira seleção, não uma tabela exaustiva.

## Verificações

- `npm run typecheck`
- `npm test`
- `npm run build`

O teste de integração de migrações usa PostgreSQL real quando
`TEST_DATABASE_URL` aponta para um banco de teste acessível. Ele cria e remove
um schema temporário, portanto o usuário do banco precisa ter permissão para
criar schemas. Sem essa variável, os testes de integração são ignorados fora do
CI. No GitHub Actions, um PostgreSQL 17 descartável é iniciado para cada
execução, e a integração falha se `TEST_DATABASE_URL` não estiver configurada.
O banco de CI é isolado e não usa credenciais nem dados de produção.
