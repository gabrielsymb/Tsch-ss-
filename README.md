# Tschüss

Catálogo pesquisável de conceitos e referências, com uma interface web
responsiva e uma API JSON. O conteúdo atual reúne verbetes de cálculo; o nome e
a identidade do app não limitam futuras áreas.

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
5. Inicie o serviço com `npm run dev` e abra `http://127.0.0.1:3000/` para a
   interface ou `/api/v1/entries` para consultar a API.

`npm run dev` reaplica de forma idempotente as migrações e o catálogo antes de
iniciar o servidor, evitando que uma funcionalidade nova execute contra um
schema antigo.

### Atalho local

Em Linux, o arquivo `launchers/Iniciar-Tschuss.desktop` pode ser copiado para a
área de trabalho e aberto com dois cliques. Ele verifica se o app já está
rodando, inicia o PostgreSQL quando necessário, aplica as migrações, sobe o
servidor e abre `http://127.0.0.1:3000/` no navegador. A janela do terminal deve
permanecer aberta enquanto o servidor estiver em uso.

O comando `npm run db:init` aplica, em ordem, as migrações SQL ainda pendentes
em `database/migrations/` e atualiza o catálogo inicial. As versões aplicadas
e checksums são registradas em `schema_migrations`; migrações aplicadas não
devem ser editadas — crie uma nova migração para mudanças futuras.

Em bancos criados antes da adoção de migrações, a migração inicial usa
`IF NOT EXISTS` para registrar a estrutura atual sem recriar nem apagar os
dados. O seed permanece idempotente.

### Testar a API sem instalar PostgreSQL nem Docker

Execute `npm run dev:demo` e abra `http://127.0.0.1:3000/` para experimentar a
interface. Esse modo inicia um servidor HTTP real com poucos itens
demonstrativos em memória. Ele não conecta ao banco nem representa o catálogo
completo. A resposta de `/health` identifica esse modo com
`"database": "not-configured"`.

## Endpoints

- `GET /health` — verifica a conexão com o banco.
- `GET /api/v1/categories` — lista as categorias.
- `GET /api/v1/entries` — pesquisa com `q`, `kind`, `category`, `limit` e `offset`.
- `GET /api/v1/entries/:slug` — consulta um item do catálogo.
- `GET /api/v1/discoveries` — lista conteúdos aprovados e armazenados para Descobertas.
- `GET /` — interface web responsiva para pesquisa e consulta.

`kind` aceita `derivative`, `integral`, `technique` ou `reference`. A resposta
de pesquisa contém `data` e `pagination`; cada item inclui categoria, condições, notas e
referência bibliográfica. Também expõe aliases, notações, exemplos resolvidos,
aplicações, condições estruturadas, referências relacionadas e relações com
outros itens. Os campos anteriores (`conditions` e `source`) permanecem
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
por item, sem duplicação por aliases/notações. A migração
`004_reference_entries.sql` permite itens de referência além de derivadas,
integrais e técnicas. O catálogo inicial inclui uma tabela de integrais
imediatas e uma tabela de valores de seno, cosseno e tangente para ângulos
notáveis, ambas pesquisáveis como tabelas de consulta.

A interface permite pesquisar por nome ou notação, filtrar por tipo e
categoria, consultar detalhes, condições e referências, e navegar pelos
resultados. Ela usa somente recursos locais, sem scripts de rastreamento ou
cadastro. O KaTeX e suas fontes são servidos localmente; fórmulas dos resultados,
detalhes e exemplos são compostas no navegador. Se uma expressão LaTeX for
inválida, sua notação original permanece visível como alternativa legível.

## Descobertas: coleta, curadoria e publicação

O feed é alimentado no backend pelo RSS de Matemática da [Quanta Magazine](https://www.quantamagazine.org/mathematics/feed/)
e pela API de trabalhos do [OpenAlex](https://api.openalex.org/works). O
servidor coleta ao iniciar e a cada 12 horas; abrir a página não consulta essas
fontes. Os itens e o estado editorial ficam no PostgreSQL, com deduplicação por
fonte e identificador. Se uma fonte falhar, a outra ainda pode atualizar; itens
já aprovados permanecem disponíveis. O modo demo não inventa um feed.

A migração `005_discoveries.sql` cria o armazenamento de candidatos, itens
aprovados e controle diário de chamadas de IA. Sem `GEMINI_API_KEY`, o coletor
continua guardando candidatos como pendentes, mas não gera conteúdo para
publicação. Com a chave configurada somente no servidor, a curadoria usa
`gemini-3.5-flash-lite`, até quatro novos candidatos por ciclo e no máximo oito
chamadas por dia. Esses limites são controles locais; as quotas efetivas do
Google podem variar por projeto. Se o projeto não tiver acesso, o servidor tenta
o modelo legado gratuito `gemini-2.5-flash-lite`. Se
ambos os modelos estiverem indisponíveis ou uma quota for atingida, o item
permanece armazenado para nova tentativa e o erro é registrado no log. Não há
troca automática para modelo pago nem ativação de faturamento.

Uma resposta só é publicada quando o JSON passa pela validação, a decisão é
aprovar, a relevância é pelo menos 75/100 e a confiança é pelo menos 0,85.
Itens incertos, malformados ou com pontuação insuficiente ficam em revisão; os
irrelevantes podem ser rejeitados. As facetas “De onde veio?”, “Por que
funciona?”, “Onde isso aparece?” e “Quem descobriu?” só aparecem quando a
curadoria fornece uma evidência textual que pode ser localizada no material
recebido. Relações usam slugs existentes no catálogo. O feed exibe título e
resumo didáticos em português brasileiro, preservando o título original,
autoria, fonte, data e link; não copia artigos completos nem exibe o trecho
usado internamente como contexto da curadoria.

O OpenAlex declara seus metadados sob CC0 e permite uso gratuito da API; uma
chave gratuita é opcional. O RSS da Quanta não indica uma licença de republicação
no próprio feed: o app guarda apenas os metadados e uma descrição curta para
curadoria, sem republicar o texto do artigo. Consulte os
[termos do Gemini](https://ai.google.dev/gemini-api/docs/terms): no nível
gratuito, dados enviados podem ser usados para melhorar serviços e revisados
por pessoas. A integração envia apenas material público, nunca dados pessoais
ou confidenciais. O modelo e a chave permanecem no backend; a seção solicita
confirmação de 18 anos antes de exibir conteúdos.

Para ativar a curadoria, obtenha uma chave no Google AI Studio usando a opção
gratuita e configure `GEMINI_API_KEY` no ambiente do servidor (ou no `.env`
local, que não é versionado). Não habilite faturamento para essa configuração.
Sem a chave, a seção continuará vazia até que existam itens aprovados por
curadoria. A revisão editorial pendente é preservada no banco e não é publicada
automaticamente.

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
