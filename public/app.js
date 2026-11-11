const pageSize = 20;
const searchDebounceMs = 280;
const kindNames = {
  derivative: "Derivada",
  integral: "Integral",
  technique: "Técnica",
  reference: "Tabela",
};
const relationNames = {
  generalization: "Generalização",
  special_case: "Caso particular",
  related: "Relacionado",
  prerequisite: "Pré-requisito",
};

const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const suggestionsElement = document.querySelector("#suggestions");
const kindSelect = document.querySelector("#kind");
const categorySelect = document.querySelector("#category");
const clearButton = document.querySelector("#clear-filters");
const filterToggle = document.querySelector("#toggle-filters");
const resultsElement = document.querySelector("#results");
const statusElement = document.querySelector("#status");
const filterStatusElement = document.querySelector("#filter-status");
const paginationElement = document.querySelector("#pagination");
const detailElement = document.querySelector("#entry-detail");
const contentLayout = document.querySelector(".content-layout");
const welcomeElement = document.querySelector("#welcome");
const searchPanel = document.querySelector("#search-panel");
const demoNotice = document.querySelector("#demo-notice");
const healthNotice = document.querySelector("#health-notice");
const discoveriesNav = document.querySelector("#discoveries-nav");
const discoveriesPanel = document.querySelector("#discoveries");
const discoveryAgeGate = document.querySelector("#discovery-age-gate");
const discoveryAgeButton = document.querySelector("#confirm-discovery-age");
const discoveryContent = document.querySelector("#discovery-content");
const discoveryStatus = document.querySelector("#discovery-status");
const discoveryCards = document.querySelector("#discovery-cards");
const exploreDiscoveriesButton = document.querySelector("#explore-discoveries");
const discoveryExploration = document.querySelector("#discovery-exploration");
const discoveryResults = document.querySelector("#discovery-results");
const discoveryPagination = document.querySelector("#discovery-pagination");
const discoveryTopicNames = {
  mathematics: "Matemática",
  statistics: "Estatística",
  probability: "Probabilidade",
  computing: "Computação",
  physics: "Física",
  economics: "Economia",
  other: "Áreas relacionadas",
};
const discoveryDifficultyNames = {
  introductory: "Introdutório",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
const discoveryFacetNames = {
  "de-onde-veio": "De onde veio?",
  "por-que-funciona": "Por que funciona?",
  "onde-aparece": "Onde isso aparece?",
  "quem-descobriu": "Quem descobriu?",
};

let offset = 0;
let total = 0;
let discoveryOffset = 0;
let discoveryTotal = 0;
let selectedSlug = "";
let searchTimer;
let searchRequestId = 0;
let detailRequestId = 0;
let searchController;
let detailController;
let suggestionEntries = [];
const formulaResizeObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) fitFormula(target);
});

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function appendRichText(parent, text) {
  const inlineMath = /\\\((.+?)\\\)/gs;
  let cursor = 0;
  let match;

  while ((match = inlineMath.exec(text)) !== null) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    parent.append(makeFormula(match[1], `Expressão matemática: ${match[1]}`, false));
    cursor = inlineMath.lastIndex;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}

function formatAngleStep(step) {
  const match = /^(sen|cos|tan)\((\d+)°\) = (.+)$/.exec(step);
  if (!match) return step;

  const [, functionName, angle, value] = match;
  const functionLatex = { sen: "\\sin", cos: "\\cos", tan: "\\tan" }[functionName];
  const valueLatex = value
    .replace("√", "\\sqrt{")
    .replace(/\\sqrt\{([^/]+)(?=\/|$)/, "\\sqrt{$1}")
    .replace(/(\d+)\/(\d+)/, "\\frac{$1}{$2}");
  return `${functionLatex}(${angle}^\\circ) = ${valueLatex}`;
}

function createRichTextParagraph(text) {
  const paragraph = makeElement("p");
  appendRichText(paragraph, text);
  return paragraph;
}

function makeFormula(source, label, displayMode = true) {
  const formula = makeElement(
    displayMode ? "div" : "span",
    displayMode ? "formula" : "formula formula-inline",
  );
  formula.setAttribute("aria-label", label);
  try {
    window.katex.render(source, formula, { displayMode, throwOnError: true });
  } catch {
    formula.textContent = "Fórmula indisponível";
    formula.classList.add("formula-fallback");
    formula.title = "Não foi possível compor esta fórmula.";
  }
  formulaResizeObserver.observe(formula);
  window.requestAnimationFrame(() => fitFormula(formula));
  return formula;
}

function fitFormula(formula) {
  const display = formula.querySelector(".katex-display");
  const math = display?.querySelector(":scope > .katex");
  if (!display || !math || display.clientWidth === 0) return;

  math.style.fontSize = "";
  const scale = Math.min(1, display.clientWidth / math.scrollWidth);
  if (scale < 1) math.style.fontSize = `${scale * 100}%`;
}

async function requestJson(url, signal) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }
  return response.json();
}

async function loadCategories() {
  const payload = await requestJson("/api/v1/categories");
  for (const category of payload.data) {
    const option = document.createElement("option");
    option.value = category.slug;
    option.textContent = category.name;
    categorySelect.append(option);
  }
}

async function loadDemoNotice() {
  const health = await requestJson("/health");
  if (health.database === "not-configured") {
    demoNotice.textContent =
      "Modo de demonstração: há apenas alguns exemplos de cálculo, não o catálogo completo.";
    demoNotice.hidden = false;
  }
}

function updateClearButton() {
  clearButton.disabled =
    queryInput.value.trim() === "" && kindSelect.value === "" && categorySelect.value === "";
}

function showCatalog() {
  welcomeElement.hidden = true;
  discoveriesPanel.hidden = true;
  contentLayout.hidden = false;
}

function showWelcome() {
  window.clearTimeout(searchTimer);
  searchController?.abort();
  searchRequestId += 1;
  welcomeElement.hidden = false;
  discoveriesPanel.hidden = false;
  closeFilters();
  contentLayout.hidden = true;
  hideSuggestions();
  total = 0;
  resultsElement.replaceChildren();
  paginationElement.replaceChildren();
  setStatus("");
  clearDetail();
  updateClearButton();
}

function confirmDiscoveryAge() {
  discoveryAgeGate.hidden = true;
  discoveryContent.hidden = false;
  loadHomeDiscoveries();
}

function createDiscoveryCard(discovery) {
  const item = document.createElement("li");
  const article = makeElement("article", "discovery-card");
  const heading = makeElement("h3", "", discovery.title);
  const metadata = makeElement("p", "discovery-meta");
  const date = discovery.publishedAt ? formatDiscoveryDate(discovery.publishedAt) : "";
  metadata.textContent = [
    discoveryTopicNames[discovery.topic] || "Matemática",
    discoveryDifficultyNames[discovery.difficulty] || "",
    Array.isArray(discovery.authors) && discovery.authors.length
      ? discovery.authors.join(", ")
      : "",
    discovery.sourceName,
    date,
  ].filter(Boolean).join(" · ");

  const summary = makeElement("p", "discovery-summary", discovery.summary);
  article.append(heading, metadata, summary);

  if (Array.isArray(discovery.facets) && discovery.facets.length) {
    const facets = makeElement("dl", "discovery-facets");
    for (const facet of discovery.facets) {
      const name = discoveryFacetNames[facet.category];
      if (!name || !facet.text || !facet.evidence) continue;
      facets.append(
        makeElement("dt", "", name),
        makeElement("dd", "", facet.text),
      );
    }
    if (facets.childElementCount) article.append(facets);
  }

  const footer = makeElement("div", "discovery-footer");
  const sourceUrl = safeExternalUrl(discovery.sourceUrl);
  if (sourceUrl) {
    const sourceLink = makeElement(
      "a",
      "discovery-source-link",
      discovery.originalTitle || "Abrir publicação original",
    );
    sourceLink.href = sourceUrl;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    footer.append(sourceLink);
  }

  if (Array.isArray(discovery.relatedEntrySlugs) && discovery.relatedEntrySlugs.length) {
    const related = makeElement("div", "discovery-related");
    related.append(makeElement("span", "", "No dicionário: "));
    for (const slug of discovery.relatedEntrySlugs) {
      const button = makeElement("button", "discovery-entry-link", slug.replaceAll("-", " "));
      button.type = "button";
      button.addEventListener("click", () => {
        showCatalog();
        resultsElement.replaceChildren();
        paginationElement.replaceChildren();
        showEntry(slug);
      });
      related.append(button);
    }
    footer.append(related);
  }

  article.append(footer);
  item.append(article);
  return item;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function formatDiscoveryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

async function loadHomeDiscoveries() {
  discoveryCards.setAttribute("aria-busy", "true");
  discoveryStatus.textContent = "Carregando descobertas…";
  try {
    const payload = await requestJson("/api/v1/discoveries?limit=4");
    discoveryCards.replaceChildren(...payload.data.map(createDiscoveryCard));
    discoveryTotal = payload.pagination.total;
    exploreDiscoveriesButton.hidden = discoveryTotal <= payload.data.length;
    if (payload.data.length === 0) {
      discoveryStatus.textContent =
        "Ainda não há conteúdo aprovado. A curadoria pode continuar trabalhando em segundo plano.";
      const retry = makeElement("button", "button button-secondary", "Verificar novamente");
      retry.type = "button";
      retry.addEventListener("click", loadHomeDiscoveries);
      discoveryStatus.append(document.createTextNode(" "), retry);
    } else {
      discoveryStatus.textContent = "";
    }
  } catch {
    discoveryStatus.textContent = "Não foi possível carregar as descobertas agora.";
    const retry = makeElement("button", "button button-secondary", "Tentar novamente");
    retry.type = "button";
    retry.addEventListener("click", loadHomeDiscoveries);
    discoveryStatus.append(document.createTextNode(" "), retry);
  } finally {
    discoveryCards.setAttribute("aria-busy", "false");
  }
}

async function loadDiscoveryPage({ append = false } = {}) {
  const limit = 20;
  discoveryStatus.textContent = "Carregando conteúdos…";
  try {
    const payload = await requestJson(
      `/api/v1/discoveries?limit=${limit}&offset=${discoveryOffset}`,
    );
    discoveryTotal = payload.pagination.total;
    const cards = payload.data.map(createDiscoveryCard);
    if (append) discoveryResults.append(...cards);
    else discoveryResults.replaceChildren(...cards);
    discoveryPagination.replaceChildren();
    if (discoveryOffset + limit < discoveryTotal) {
      const more = makeElement("button", "button button-secondary", "Carregar mais");
      more.type = "button";
      more.addEventListener("click", () => {
        discoveryOffset += limit;
        loadDiscoveryPage({ append: true });
      });
      discoveryPagination.append(more);
    }
    discoveryStatus.textContent = discoveryTotal === 0
      ? "Ainda não há conteúdos aprovados para explorar."
      : `Exibindo ${Math.min(discoveryOffset + limit, discoveryTotal)} de ${discoveryTotal}.`;
  } catch {
    discoveryStatus.textContent = "Não foi possível carregar as descobertas agora.";
  }
}

function hideSuggestions() {
  suggestionsElement.hidden = true;
  suggestionsElement.replaceChildren();
  suggestionEntries = [];
  queryInput.setAttribute("aria-expanded", "false");
}

function selectSuggestion(entry) {
  queryInput.value = entry.title;
  offset = 0;
  updateClearButton();
  hideSuggestions();
  showCatalog();
  resultsElement.replaceChildren(createResult(entry));
  resultsElement.setAttribute("aria-busy", "false");
  paginationElement.replaceChildren();
  setStatus("");
  showEntry(entry.slug);
}

function renderSuggestions(entries, matchingTotal) {
  suggestionsElement.replaceChildren();
  suggestionEntries = entries;
  if (entries.length === 0) {
    suggestionsElement.append(makeElement("p", "suggestion-empty", "Nenhum item encontrado."));
  } else {
    const list = document.createElement("ul");
    for (const [index, entry] of entries.entries()) {
      const option = makeElement("button", "suggestion-option");
      option.type = "button";
      option.id = `suggestion-${index}`;
      option.setAttribute("role", "option");
      option.append(
        makeElement("span", "suggestion-title", entry.title),
        makeElement(
          "span",
          "suggestion-meta",
          `${kindNames[entry.kind] || "Item"} · ${entry.category.name}`,
        ),
      );
      option.addEventListener("click", () => selectSuggestion(entry));
      option.addEventListener("keydown", (event) => {
        const options = [...suggestionsElement.querySelectorAll(".suggestion-option")];
        const currentIndex = options.indexOf(option);
        if (event.key === "ArrowDown" && currentIndex < options.length - 1) {
          event.preventDefault();
          options[currentIndex + 1].focus();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          if (currentIndex > 0) options[currentIndex - 1].focus();
          else queryInput.focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          hideSuggestions();
          queryInput.focus();
        }
      });
      const item = document.createElement("li");
      item.append(option);
      list.append(item);
    }
    suggestionsElement.append(list);

    if (matchingTotal > entries.length) {
      const showAll = makeElement(
        "button",
        "suggestion-show-all",
        `Ver todos os ${matchingTotal} resultados`,
      );
      showAll.type = "button";
      showAll.addEventListener("click", () => {
        hideSuggestions();
        offset = 0;
        searchEntries();
      });
      suggestionsElement.append(showAll);
    }
  }
  suggestionsElement.hidden = false;
  queryInput.setAttribute("aria-expanded", "true");
}

function setStatus(message, { error = false, actionLabel, onAction } = {}) {
  statusElement.replaceChildren();
  statusElement.classList.toggle("status-error", error);
  statusElement.setAttribute("role", error ? "alert" : "status");
  statusElement.setAttribute("aria-live", error ? "assertive" : "polite");
  if (!message) return;

  statusElement.append(makeElement("span", "", message));
  if (actionLabel && onAction) {
    const action = makeElement("button", "button button-secondary status-action", actionLabel);
    action.type = "button";
    action.addEventListener("click", onAction);
    statusElement.append(action);
  }
}

function createResult(entry) {
  const item = document.createElement("li");
  const article = makeElement("article", "entry-card");
  article.setAttribute("aria-current", String(entry.slug === selectedSlug));

  const top = makeElement("div", "entry-card-top");
  const button = makeElement("button", "entry-title-button", entry.title);
  button.type = "button";
  button.dataset.entrySlug = entry.slug;
  button.setAttribute("aria-expanded", String(entry.slug === selectedSlug));
  button.setAttribute("aria-controls", "entry-detail");
  button.addEventListener("click", () => showEntry(entry.slug));

  const kind = makeElement("span", "entry-kind", kindNames[entry.kind] || "Item");
  top.append(button, kind);

  const meta = makeElement("div", "entry-meta");
  meta.append(makeElement("span", "", entry.category.name));

  article.append(top, meta);
  item.append(article);
  return item;
}

function renderPagination() {
  paginationElement.replaceChildren();
  if (total <= pageSize) return;

  const previous = makeElement("button", "button button-secondary", "Anterior");
  previous.type = "button";
  previous.disabled = offset === 0;
  previous.addEventListener("click", () => {
    offset = Math.max(0, offset - pageSize);
    searchEntries();
  });

  const next = makeElement("button", "button button-secondary", "Próxima");
  next.type = "button";
  next.disabled = offset + pageSize >= total;
  next.addEventListener("click", () => {
    offset += pageSize;
    searchEntries();
  });

  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + pageSize, total);
  paginationElement.append(
    previous,
    makeElement("p", "", `Exibindo ${start}–${end} de ${total}`),
    next,
  );
}

function clearDetail() {
  detailController?.abort();
  detailController = undefined;
  detailRequestId += 1;
  selectedSlug = "";
  detailElement.hidden = true;
  detailElement.setAttribute("aria-busy", "false");
  detailElement.replaceChildren();
  contentLayout.classList.remove("has-detail");
  for (const card of resultsElement.querySelectorAll(".entry-card")) {
    card.setAttribute("aria-current", "false");
    card.querySelector(".entry-title-button").setAttribute("aria-expanded", "false");
  }
}

async function searchEntries({ suggestionsOnly = false } = {}) {
  window.clearTimeout(searchTimer);
  if (suggestionsOnly) {
    hideSuggestions();
    welcomeElement.hidden = true;
    contentLayout.hidden = true;
  } else {
    hideSuggestions();
    showCatalog();
  }
  searchController?.abort();
  searchController = new AbortController();
  const requestId = ++searchRequestId;
  const signal = searchController.signal;
  clearDetail();
  updateClearButton();
  resultsElement.setAttribute("aria-busy", "true");
  if (!suggestionsOnly) setStatus("Atualizando resultados…");

  const params = new URLSearchParams({
    limit: String(suggestionsOnly ? 5 : pageSize),
    offset: String(suggestionsOnly ? 0 : offset),
  });
  if (queryInput.value.trim()) params.set("q", queryInput.value.trim());
  if (kindSelect.value) params.set("kind", kindSelect.value);
  if (categorySelect.value) params.set("category", categorySelect.value);

  try {
    const payload = await requestJson(`/api/v1/entries?${params}`, signal);
    if (requestId !== searchRequestId) return;

    if (suggestionsOnly) {
      renderSuggestions(payload.data, payload.pagination.total);
      return;
    }

    total = payload.pagination.total;
    resultsElement.replaceChildren(...payload.data.map(createResult));
    renderPagination();
    if (payload.data.length === 0) {
      setStatus("Nenhum item encontrado. Tente outro termo ou ajuste os filtros.");
    } else {
      setStatus("");
    }
  } catch {
    if (signal.aborted || requestId !== searchRequestId) return;
    total = 0;
    resultsElement.replaceChildren();
    paginationElement.replaceChildren();
    if (suggestionsOnly) {
      suggestionsElement.replaceChildren(
        makeElement("p", "suggestion-empty", "Não foi possível carregar sugestões."),
      );
      const retry = makeElement("button", "suggestion-show-all", "Tentar novamente");
      retry.type = "button";
      retry.addEventListener("click", () => searchEntries({ suggestionsOnly: true }));
      suggestionsElement.append(retry);
      suggestionsElement.hidden = false;
      queryInput.setAttribute("aria-expanded", "true");
      return;
    }
    setStatus("Não foi possível carregar os resultados agora. Tente novamente.", {
      error: true,
      actionLabel: "Tentar novamente",
      onAction: () => searchEntries(),
    });
  } finally {
    if (requestId === searchRequestId) {
      resultsElement.setAttribute("aria-busy", "false");
      searchController = undefined;
    }
  }
}

function scheduleSearch() {
  window.clearTimeout(searchTimer);
  searchController?.abort();
  searchRequestId += 1;
  if (
    queryInput.value.trim() === "" &&
    kindSelect.value === "" &&
    categorySelect.value === ""
  ) {
    showWelcome();
    return;
  }
  if (queryInput.value.trim().length < 2) {
    hideSuggestions();
    welcomeElement.hidden = false;
    contentLayout.hidden = true;
    return;
  }
  resultsElement.setAttribute("aria-busy", "true");
  searchTimer = window.setTimeout(() => {
    offset = 0;
    searchEntries({ suggestionsOnly: true });
  }, searchDebounceMs);
}

function addDetailSection(title, content, parent = detailElement) {
  const section = makeElement("section", "detail-section");
  section.append(makeElement("h3", "", title), content);
  parent.append(section);
}

function addTextSection(title, text, parent = detailElement) {
  if (!text?.trim()) return;
  const paragraph = makeElement("p");
  appendRichText(paragraph, text);
  addDetailSection(title, paragraph, parent);
}

function addFormulaSection(title, formula, label = title) {
  if (!formula) return;
  addDetailSection(title, makeFormula(formula, label));
}

function addListSection(title, items, renderItem = (item) => item) {
  if (!items.length) return;
  const list = document.createElement("ul");
  for (const item of items) {
    const listItem = makeElement("li");
    appendRichText(listItem, renderItem(item));
    list.append(listItem);
  }
  addDetailSection(title, list);
}

function addExamples(examples, {
  reference = false,
  parent = detailElement,
  formatStep,
} = {}) {
  if (!examples.length) return;
  const content = makeElement("div", reference ? "reference-list" : "");
  for (const example of examples) {
    const article = makeElement("article", reference ? "detail-example reference-row" : "detail-example");
    article.append(makeElement("h4", "", example.title));
    if (example.prompt) {
      const prompt = makeElement("p", reference ? "reference-prompt" : "");
      appendRichText(prompt, example.prompt);
      article.append(prompt);
    }
    if (example.result) {
      article.append(makeFormula(
        example.result,
        `${reference ? "Fórmula" : "Resultado do exemplo"}: ${example.title}`,
      ));
    }
    if (example.steps.length) {
      const steps = document.createElement(reference ? "ul" : "ol");
      for (const step of example.steps) {
        const item = makeElement("li");
        if (formatStep) item.append(makeFormula(formatStep(step), step, false));
        else appendRichText(item, step);
        steps.append(item);
      }
      article.append(steps);
    }
    content.append(article);
  }
  addDetailSection(reference ? "Fórmulas e valores" : "Exemplos resolvidos", content, parent);
}

function addApplications(applications) {
  if (!applications.length) return;
  const content = document.createElement("div");
  for (const application of applications) {
    const article = makeElement("article", "detail-application");
    article.append(makeElement("h4", "", application.title));
    const description = makeElement("p");
    appendRichText(description, `${application.field}: ${application.description}`);
    article.append(description);
    if (application.example) {
      const example = makeElement("p");
      appendRichText(example, application.example);
      article.append(example);
    }
    content.append(article);
  }
  addDetailSection("Aplicações", content);
}

function addSources(sources) {
  if (!sources.length) return;
  const disclosure = document.createElement("details");
  disclosure.className = "detail-sources";
  disclosure.append(makeElement("summary", "", `Fontes (${sources.length})`));
  const list = document.createElement("ul");
  for (const source of sources) {
    const item = document.createElement("li");
    const citation = [
      source.title,
      source.publisher,
      source.license ? `Licença: ${source.license}` : "",
      source.accessedOn ? `consultado em ${source.accessedOn}` : "",
    ].filter(Boolean).join(". ");
    item.append(makeElement("span", "", citation));
    let referenceUrl = "";
    try {
      const url = new URL(source.url);
      if (url.protocol === "https:") {
        referenceUrl = url.href;
      }
    } catch {
      referenceUrl = "";
    }
    if (referenceUrl) {
      const link = makeElement("a", "source-link", "Abrir referência");
      link.href = referenceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(document.createElement("br"), link);
    } else {
      item.append(makeElement("p", "detail-message", "Link da referência indisponível."));
    }
    list.append(item);
  }
  disclosure.append(list);
  detailElement.append(disclosure);
}

function closeFilters({ returnFocus = false } = {}) {
  searchPanel.hidden = true;
  filterToggle.setAttribute("aria-expanded", "false");
  filterToggle.setAttribute("aria-label", "Abrir filtros");
  if (returnFocus) filterToggle.focus();
}

function toggleFilters() {
  if (searchPanel.hidden) {
    searchPanel.hidden = false;
    filterToggle.setAttribute("aria-expanded", "true");
    filterToggle.setAttribute("aria-label", "Fechar filtros");
    kindSelect.focus();
  } else {
    closeFilters({ returnFocus: true });
  }
}

function addAdditionalInformation(entry) {
  const hasAdditionalInformation =
    entry.aliases.length > 0 ||
    entry.notations.length > 0 ||
    entry.relatedEntries.length > 0;
  if (!hasAdditionalInformation) return;

  const disclosure = document.createElement("details");
  disclosure.className = "detail-extra";
  disclosure.append(makeElement("summary", "", "Outras notações e itens relacionados"));
  const content = makeElement("div", "detail-extra-content");

  if (entry.aliases.length) {
    const aliases = document.createElement("ul");
    for (const alias of entry.aliases) aliases.append(makeElement("li", "", alias));
    appendAdditionalSection(content, "Outras formas de escrita", aliases);
  }

  if (entry.notations.length) {
    const notations = document.createElement("ul");
    for (const notation of entry.notations) {
      const item = document.createElement("li");
      item.append(makeElement("strong", "", `${notation.label}: `));
      if (notation.format === "latex") {
        item.append(makeFormula(notation.notation, `Notação: ${notation.label}`, false));
      } else {
        item.append(document.createTextNode(notation.notation));
      }
      notations.append(item);
    }
    appendAdditionalSection(content, "Notações", notations);
  }

  if (entry.relatedEntries.length) {
    const related = document.createElement("ul");
    for (const relation of entry.relatedEntries) {
      const item = document.createElement("li");
      const button = makeElement(
        "button",
        "relation-link",
        `${relation.title} · ${relationNames[relation.relationType] || "Relacionado"}`,
      );
      button.type = "button";
      button.addEventListener("click", () => showEntry(relation.slug));
      item.append(button);
      related.append(item);
    }
    appendAdditionalSection(content, "Verbetes relacionados", related);
  }

  disclosure.append(content);
  detailElement.append(disclosure);
}

function appendAdditionalSection(parent, title, content) {
  const section = makeElement("section", "detail-section");
  section.append(makeElement("h3", "", title), content);
  parent.append(section);
}

function renderEntry(entry) {
  detailElement.replaceChildren();
  detailElement.setAttribute("aria-busy", "false");
  const top = makeElement("div", "detail-top");
  const heading = makeElement("div", "detail-heading");
  heading.append(
    makeElement("p", "eyebrow", kindNames[entry.kind] || "ITEM"),
    makeElement("h2", "detail-title", entry.title),
    makeElement("p", "detail-category", entry.category.name),
  );
  heading.querySelector(".detail-title").id = "detail-title";

  const close = makeElement("button", "detail-close", "Fechar");
  close.type = "button";
  close.setAttribute("aria-label", "Fechar detalhes do item");
  close.addEventListener("click", () => closeDetail());
  top.append(heading, close);
  detailElement.append(top);

  if (entry.kind === "reference") {
    addTextSection("Resumo", entry.result);
    const disclosure = document.createElement("details");
    disclosure.className = "reference-disclosure";
    const summary = entry.title === "Ângulos notáveis"
      ? `Ver valores de ${entry.examples.length} ângulos`
      : `Ver ${entry.examples.length} fórmulas`;
    disclosure.append(makeElement("summary", "", summary));
    disclosure.addEventListener("toggle", () => {
      if (disclosure.open) {
        window.requestAnimationFrame(() => {
          for (const formula of disclosure.querySelectorAll(".formula")) fitFormula(formula);
        });
      }
    });
    if (entry.conditions || entry.validityConditions.length || entry.notes) {
      const about = makeElement("div", "reference-about");
      if (entry.conditions) {
        appendAdditionalSection(
          about,
          "Condições",
          createRichTextParagraph(entry.conditions),
        );
      }
      if (entry.validityConditions.length) {
        const conditions = entry.validityConditions.map((condition) =>
          [condition.description, condition.predicate, condition.domain].filter(Boolean).join(" "),
        );
        appendAdditionalSection(
          about,
          "Condições detalhadas",
          createRichTextParagraph(conditions.join(" ")),
        );
      }
      if (entry.notes) {
        appendAdditionalSection(about, "Sobre", createRichTextParagraph(entry.notes));
      }
      disclosure.append(about);
    }
    addExamples(entry.examples, {
      reference: true,
      parent: disclosure,
      formatStep: entry.title === "Ângulos notáveis" ? formatAngleStep : undefined,
    });
    detailElement.append(disclosure);
  } else {
    addFormulaSection("Fórmula", entry.expression, `Fórmula: ${entry.title}`);
    addFormulaSection("Resultado", entry.result, `Resultado: ${entry.title}`);
    addTextSection("Condições de validade", entry.conditions);
    addListSection("Condições detalhadas", entry.validityConditions, (condition) =>
      [condition.description, condition.predicate, condition.domain].filter(Boolean).join(" "),
    );
    addTextSection("Explicação", entry.notes);
    addExamples(entry.examples);
    addApplications(entry.applications);
  }
  addSources(entry.sources.length ? entry.sources : [entry.source]);
  addAdditionalInformation(entry);
  detailElement.hidden = false;
}

function updateSelectedCard(slug) {
  for (const card of resultsElement.querySelectorAll(".entry-card")) {
    const button = card.querySelector(".entry-title-button");
    const isSelected = button.dataset.entrySlug === slug;
    card.setAttribute("aria-current", String(isSelected));
    button.setAttribute("aria-expanded", String(isSelected));
  }
}

async function showEntry(slug) {
  detailController?.abort();
  detailController = new AbortController();
  const requestId = ++detailRequestId;
  const signal = detailController.signal;
  selectedSlug = slug;
  updateSelectedCard(slug);
  contentLayout.classList.add("has-detail");
  detailElement.setAttribute("aria-busy", "true");
  detailElement.hidden = false;
  const loadingHeading = makeElement("h2", "detail-title", "Carregando item…");
  loadingHeading.id = "detail-title";
  detailElement.replaceChildren(
    loadingHeading,
    makeElement("p", "detail-message", "Carregando item…"),
  );
  detailElement.scrollIntoView({ block: "nearest" });

  try {
    const payload = await requestJson(`/api/v1/entries/${encodeURIComponent(slug)}`, signal);
    if (signal.aborted || requestId !== detailRequestId) return;
    renderEntry(payload.data);
  } catch {
    if (signal.aborted || requestId !== detailRequestId) return;
    detailElement.replaceChildren();
    detailElement.setAttribute("aria-busy", "false");
    const message = makeElement(
      "p",
      "detail-message",
      "Não foi possível carregar este item agora.",
    );
    const heading = makeElement("h2", "detail-title", "Detalhes indisponíveis");
    heading.id = "detail-title";
    const retry = makeElement("button", "button button-secondary status-action", "Tentar novamente");
    retry.type = "button";
    retry.addEventListener("click", () => showEntry(slug));
    detailElement.append(heading, message, retry);
  }
}

function closeDetail() {
  const previousSlug = selectedSlug;
  clearDetail();
  const previousButton = [...resultsElement.querySelectorAll(".entry-title-button")]
    .find((button) => button.dataset.entrySlug === previousSlug);
  previousButton?.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  offset = 0;
  hideSuggestions();
  searchEntries();
});

queryInput.addEventListener("input", () => {
  offset = 0;
  updateClearButton();
  scheduleSearch();
});

queryInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    const firstOption = suggestionsElement.querySelector(".suggestion-option");
    if (firstOption) {
      event.preventDefault();
      firstOption.focus();
    }
  } else if (event.key === "Escape" && !suggestionsElement.hidden) {
    hideSuggestions();
  }
});

kindSelect.addEventListener("change", () => {
  offset = 0;
  searchEntries();
});

categorySelect.addEventListener("change", () => {
  offset = 0;
  searchEntries();
});

clearButton.addEventListener("click", () => {
  form.reset();
  offset = 0;
  updateClearButton();
  queryInput.focus();
  showWelcome();
});

filterToggle.addEventListener("click", toggleFilters);
discoveryAgeButton.addEventListener("click", confirmDiscoveryAge);
exploreDiscoveriesButton.addEventListener("click", () => {
  discoveryExploration.hidden = false;
  discoveryOffset = 0;
  loadDiscoveryPage();
});
discoveriesNav.addEventListener("click", (event) => {
  event.preventDefault();
  showWelcome();
  history.replaceState(null, "", "#discoveries");
  window.requestAnimationFrame(() => discoveriesPanel.scrollIntoView({ block: "start" }));
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".search-control")) hideSuggestions();
  if (!event.target.closest("#search-panel, #toggle-filters")) closeFilters();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !detailElement.hidden) closeDetail();
  if (event.key === "Escape" && !searchPanel.hidden) closeFilters({ returnFocus: true });
});

async function initialize() {
  updateClearButton();
  const [categoriesResult, healthResult] = await Promise.allSettled([
    loadCategories(),
    loadDemoNotice(),
  ]);
  if (categoriesResult.status === "rejected") {
    filterStatusElement.textContent = "Não foi possível carregar as categorias.";
  }
  if (healthResult.status === "rejected") {
    healthNotice.textContent = "Não foi possível verificar o status do catálogo.";
    healthNotice.hidden = false;
  }
}

initialize();
