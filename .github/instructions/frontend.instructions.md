---
applyTo: "public/**,src/web.ts,frontend/**,web/**"
---

# Diretrizes de frontend do Dicionário de Cálculo

Antes de alterar os caminhos abrangidos, consulte [docs/frontend-standards.md](../../docs/frontend-standards.md). Estas regras se aplicam ao frontend definitivo e à interface temporária, mas não autorizam uma reformulação completa sem pedido explícito.

## Produto e experiência
- O produto é um dicionário mobile-first de integrais, derivadas e técnicas, não um resolvedor automático. A tarefa principal é localizar e ler um verbete em poucos toques.
- Preserve o contrato atual da API, a pesquisa, filtros, paginação, referências, aviso de demonstração e renderização de LaTeX via KaTeX.
- Use títulos e instruções concretos em português brasileiro. Priorize reconhecimento sobre memorização; mostre condições de validade junto da fórmula.
- Estabeleça hierarquia clara, agrupe informações relacionadas e adote padrões conhecidos de busca e navegação. Não imponha menus ou etapas apenas para demonstrar princípios de UX.
- Não acrescente alegações, avaliações, números, depoimentos ou promessas sem dados verificáveis.

## Linguagem visual
- Prefira composição limpa, contraste alto, poucos elementos simultâneos e espaçamento interno responsivo. Nunca encoste conteúdo útil na borda da tela só para eliminar margens.
- Evite gradiente roxo, botões em formato de pílula, animações excessivas, cursor animado, imagens geradas por IA com aparência documental e emojis como ícones.
- Ícones devem ser SVGs reutilizáveis em arquivos separados, referenciados por caminho/importação; não incorporar blocos SVG ao CSS ou espalhar markup SVG duplicado pela lógica da página.
- Respeite preferências de movimento reduzido e não adicione animação sem função clara.

## Acessibilidade
- Trate WCAG 2.2 nível AA como objetivo de aceitação. Garanta contraste, foco visível, rótulos, semântica HTML, navegação por teclado, alvos tocáveis confortáveis e alternativa textual a imagens informativas.
- Fórmulas devem ter apresentação acessível e fallback legível quando o LaTeX falhar; não torne a informação matemática dependente apenas de cor ou imagem.
- Verifique telas estreitas (320 e 390 px), zoom e ausência de rolagem horizontal da página; fórmulas longas podem ter rolagem horizontal própria.

## Desempenho sem complexidade prematura
- Não duplique chamadas à API; ao implementar busca durante digitação, use debounce e cancele/ignore respostas obsoletas. Mantenha busca por Enter/botão acessível.
- Preserve paginação no servidor (atualmente 20 resultados por página). Só use virtualização se medições mostrarem necessidade.
- Mostre estados reais de carregamento, vazio e erro. Skeleton apenas quando contribuir, evitando piscadas em respostas rápidas.
- Use cache sensato para estáticos e carregamento tardio de recursos não essenciais. Se surgirem imagens, prefira WebP/AVIF, dimensões declaradas, lazy loading fora da tela e licença adequada.
- Evite novos frameworks, filas, CDN, telemetria ou dependências sem um problema medido. Otimize consultas N+1, índices e pool no backend se diagnóstico mostrar necessidade.

## Privacidade, conteúdo e entrega
- Colete somente dados necessários e preserve a ausência atual de tracking e cadastro. Não acrescente scripts de rastreamento.
- Avalie política de privacidade, consentimento e cookies conforme o processamento real de dados e as orientações da ANPD. Não invente banner, política de reembolso ou termos comerciais quando não se aplicam.
- Use recursos visuais de domínio público ou devidamente licenciados e mantenha atribuições exigidas.
- Antes de concluir: execute testes, typecheck e build; verifique teclado, contraste, viewport móvel, notação matemática, erros de API e carregamento em conexão lenta. Relate o que foi realmente testado e o que ficou pendente.
