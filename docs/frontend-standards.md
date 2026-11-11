# Padrões de UX, acessibilidade e desempenho
Tschüss | Catálogo de consulta que começou com conteúdo de cálculo

## Objetivo e escopo

O produto é um catálogo pesquisável de conceitos e referências, iniciado com conteúdo de cálculo e preparado para outros assuntos. A página inicial deve comunicar a busca de forma neutra, sem apresentar uma área atual como se fosse o escopo permanente do app. Quando houver conteúdo matemático, a pessoa pode pesquisar por nome/símbolo/notação, escolher um item e consultar fórmula, condições e exemplos. A interface deve ser discreta, legível, sem cadastro obrigatório e sem alegações inventadas.

Este documento **não é uma lista de funcionalidades a construir automaticamente**. Uma orientação só deve gerar trabalho quando melhorar uma tarefa real ou corrigir um problema observado. Não substituir decisões arquiteturais funcionais ou acrescentar dependências por modismo. Antes de aplicar uma referência, consultar sua fonte original e explicar a relação com o caso concreto.

## Heurísticas de UX aplicadas ao produto

| Princípios de referência | Aplicação responsável |
| --- | --- |
| Lei de Hick; Lei de Miller | Reduzir escolhas simultâneas e dividir informações em blocos. Não interpretar “7 ± 2” como limite rígido para menus. |
| Lei de Fitts | Botões e alvos de toque confortáveis, especialmente busca, filtros e abrir/fechar um item. |
| Lei de Jakob | Usar comportamento conhecido de campos de busca, filtros, resultados e navegação no celular. |
| Lei da proximidade; Lei da semelhança; Conectividade uniforme; Lei de Prägnanz | Agrupar informações relacionadas, como fórmula, condições, explicações e referências; manter consistência visual e composição simples. |
| Limiar de Doherty | Dar retorno rápido e perceptível após uma ação; medir latência real, sem prometer 400 ms em toda rede. |
| Efeito Von Restorff; Efeito de posição serial | Destacar o principal resultado/ação e manter ações importantes fáceis de encontrar, sem chamar atenção para tudo ao mesmo tempo. |
| Efeito Zeigarnik | Permitir retomar tarefas quando houver progresso real; não usar interrupções artificiais para forçar engajamento. |
| Lei de Tesler | Conservar complexidade matemática necessária, mas apresentar gradualmente detalhes e condições. |
| Lei de Postel | Aceitar variações razoáveis de escrita na busca; manter validação estrita de entradas perigosas e contrato da API. |
| Princípio de Pareto; Lei de Parkinson; Navalha de Ockham | Priorizar os itens e fluxos mais úteis, limitar escopo e escolher a solução simples que resolve o problema. Não tratar esses princípios como garantias matemáticas de resultado. |

| Jamais vazar contexto de desenvolvimento para usuário comum na interface. |

Referência primária para pesquisa, não substituta de testes com usuários: [Laws of UX](https://lawsofux.com/). Verificar cada lei antes de invocá-la em justificativas de design.

## Restrições visuais e de conteúdo

- Não usar gradiente roxo, botões pílula, efeitos de cursor, animações excessivas, emoji como ícone, fotos falsas de IA, avaliações falsas, métricas falsas, contadores inventados, promessas vagas ou selo “feito por IA”.
- Textos iniciais devem dizer a função do produto. Evitar travessões como recurso estilístico recorrente na interface.
- Ícones em SVG são arquivos próprios, organizados em uma pasta de recursos e chamados por importação/caminho. Manter favicon.
- Manter espaço interno responsivo, inclusive nas laterais do celular. A preferência por evitar grandes margens não significa encostar conteúdo nas bordas.
- Deixar filtros recolhidos atrás de um botão com ícone SVG; o painel deve sobrepor o conteúdo em vez de reservar espaço quando fechado. Manter fontes e tabelas de referência em seções recolhidas até a pessoa solicitar.
- Ajustar fórmulas longas à largura disponível sem barras de rolagem internas; preservar tamanho legível e apresentação matemática acessível.
- Imagens, se houver: licença ou domínio público comprovado, atribuição quando exigida, alt informativo, formatos WebP/AVIF quando adequados e sem fotos artificiais apresentadas como registros reais.
- A interface atual já tem favicon, busca, paginação e foco visível. Melhorar pontualmente, sem reescrever tudo.

## Acessibilidade, privacidade e questões jurídicas

- Almejar [WCAG 2.2 AA](https://www.w3.org/Translations/WCAG22-pt-BR/): teclado, foco, contraste, semântica, rótulos, alternativas textuais e feedback compreensível. Validar também navegação em 320/390 px e com zoom.
- Manter KaTeX local para fórmulas e trechos matemáticos em texto; marcar matemática inline com `\(...\)` e nunca exibir código LaTeX cru como fallback. Conferir legibilidade e navegação em fórmulas longas.
- Evitar repetir a fórmula da prévia nos resultados e nos detalhes; mostrar a matemática no contexto em que será consultada.
- Coletar o mínimo de dados. Documentar precisamente os dados tratados (inclusive eventuais logs de servidor), sua finalidade e retenção. Política de privacidade deve refletir a implementação, não texto genérico.
- Não instalar tracking. Se futuros cookies não essenciais forem adicionados, revisar consentimento, rejeição e transparência conforme o [Guia da ANPD sobre cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais). Não exibir banner fictício quando não houver tal tratamento.
- Termos de serviço podem ser avaliados conforme a forma de disponibilização. “Termos e condições” e “termos de serviço” não precisam virar páginas duplicadas. Política de reembolso só faz sentido se houver transação comercial sujeita a essa política.
- Questões jurídicas requerem verificação própria; estas orientações de produto não constituem parecer jurídico.

## Desempenho: aplicar quando houver necessidade

| Tema | Critério neste projeto |
| --- | --- |
| Busca e API | Mostrar até cinco sugestões selecionáveis enquanto a pessoa digita; manter resultados completos sob solicitação. Usar debounce, cancelar/ignorar requisições antigas e evitar chamadas repetidas. |
| Paginação e virtualização | Manter paginação da API. Não virtualizar uma página de 20 resultados sem evidência de problema. |
| Skeletons e atualização otimista | Usar feedback real de carregamento/erro; skeleton apenas se útil. Atualização otimista só cabe em futuras ações de escrita, não na simples consulta. |
| Imagens e scripts | Lazy loading fora da tela e WebP/AVIF se existirem imagens; evitar scripts de terceiros, carregar o não essencial tardiamente. |
| Arquivos estáticos | Cache adequado. CDN é opção de implantação após medir necessidades, não obrigação; evitar serviço externo desnecessário. |
| API e banco | Timeout para serviços externos futuros; verificar N+1, índices comuns, pool e consultas lentas com medições. OpenTelemetry e filas de tarefas só se houver necessidade real de observabilidade/processamento assíncrono. |
| Dependências e renderização | Remover dependências não usadas e evitar renderizações redundantes. Testar smartphone e rede lenta, com medições antes/depois. |

Referências técnicas: [web.dev Performance](https://web.dev/learn/performance/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [KaTeX Browser](https://katex.org/docs/browser.html).

|jamais misturar logica com interface|
|prefira navbar aparente em toda navegação e rolagem|
|ao inves de fuicar no fluxo da pagina ocupando espaço ultil e
sendo escondido pela rolagem forçando rolar para cima apra pesquisar|
| use ancoras para puxar pro top da pagina|
## Checklist de aceite de qualquer alteração visual

1. A pessoa entende que o produto é um catálogo amplo, recebe sugestões selecionáveis ao buscar e encontra um item sem precisar aprender a estrutura do sistema?
2. Quando houver matemática, fórmula, domínio/condições e fonte são legíveis; falhas têm mensagem e fallback?
3. Busca, filtros recolhidos, paginação e detalhes continuam funcionando? O modo demo permanece identificado e seus limites são claros?
4. Testado com teclado, zoom, 320 px, 390 px e largura desktop? Há foco visível e contraste suficiente?
5. Sem alegações, imagens, métricas, rastreadores, cookies ou dependências indevidas?
6. Requisições duplicadas, atrasos e estados de carregamento foram verificados quando relevantes?
7. Foram executados npm run typecheck, npm test e npm run build? Se o PostgreSQL local não estiver disponível, a CI foi conferida antes de considerar a entrega totalmente validada?
8. A resposta do Copilot registra quais fontes externas consultou, quais decisões tomou e quais verificações executou, sem afirmar testes não realizados?

## Fontes de processo

- [GitHub: instruções por caminho para Copilot](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide)
- [Laws of UX](https://lawsofux.com/)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [ANPD: guia orientativo sobre cookies](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais)
