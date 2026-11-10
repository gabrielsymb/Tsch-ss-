const pageSize = 20;
const kindNames = {
  derivative: "Derivada",
  integral: "Integral",
  technique: "Técnica",
};

const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const kindSelect = document.querySelector("#kind");
const categorySelect = document.querySelector("#category");
const clearButton = document.querySelector("#clear-filters");
const resultsElement = document.querySelector("#results");
const countElement = document.querySelector("#result-count");
const statusElement = document.querySelector("#status");
const paginationElement = document.querySelector("#pagination");
const detailElement = document.querySelector("#entry-detail");
const demoNotice = document.querySelector("#demo-notice");

let offset = 0;
let total = 0;
let selectedSlug = "";

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeFormula(source, displayMode = true) {
  const formula = makeElement("div", "formula");
  formula.setAttribute("aria-label", `Fórmula em notação LaTeX: ${source}`);
  try {
    window.katex.render(source, formula, { displayMode, throwOnError: true });
  } catch {
    formula.textContent = source;
    formula.classList.add("formula-fallback");
    formula.title = "Não foi possível compor a fórmula; exibindo a notação LaTeX original.";
  }
  return formula;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `A solicitação falhou (${response.status}).`);
  }
  return payload;
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

function createResult(entry) {
  const item = document.createElement("li");
  const article = makeElement("article", "entry-card");
  article.setAttribute("aria-current", String(entry.slug === selectedSlug));

  const button = makeElement("button", "entry-title-button", entry.title);
  button.type = "button";
  button.dataset.entrySlug = entry.slug;
  button.setAttribute("aria-expanded", String(entry.slug === selectedSlug));
  button.addEventListener("click", () => showEntry(entry.slug));

  const meta = makeElement("div", "entry-meta");
  meta.append(makeElement("span", "kind-label", kindNames[entry.kind] || "Verbete"));
  meta.append(makeElement("span", "", entry.category.name));

  article.append(button, meta);
  if (entry.result) {
    article.append(makeFormula(entry.result));
  }
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
    makeElement("p", "", `${start}-${end} de ${total}`),
    next,
  );
}

async function searchEntries() {
  statusElement.textContent = "Buscando verbetes…";
  countElement.textContent = "";
  resultsElement.replaceChildren();
  paginationElement.replaceChildren();

  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
  });
  if (queryInput.value.trim()) params.set("q", queryInput.value.trim());
  if (kindSelect.value) params.set("kind", kindSelect.value);
  if (categorySelect.value) params.set("category", categorySelect.value);

  try {
    const payload = await requestJson(`/api/v1/entries?${params}`);
    total = payload.pagination.total;
    selectedSlug = "";
    detailElement.hidden = true;
    detailElement.replaceChildren();
    countElement.textContent = `${total} ${total === 1 ? "verbete" : "verbetes"}`;
    if (payload.data.length === 0) {
      statusElement.textContent = "Nenhum verbete encontrado. Tente outros termos ou filtros.";
      return;
    }
    statusElement.textContent = "";
    for (const entry of payload.data) resultsElement.append(createResult(entry));
    renderPagination();
  } catch (error) {
    statusElement.textContent = `Não foi possível carregar os resultados. ${error.message}`;
  }
}

function addDetailSection(title, content) {
  const section = makeElement("section", "detail-section");
  section.append(makeElement("h3", "", title));
  section.append(content);
  detailElement.append(section);
}

function addTextSection(title, text) {
  if (!text) return;
  addDetailSection(title, makeElement("p", "", text));
}

function addFormulaSection(title, formula) {
  if (!formula) return;
  addDetailSection(title, makeFormula(formula));
}

function addListSection(title, items, renderItem = (item) => item) {
  if (!items.length) return;
  const list = document.createElement("ul");
  for (const value of items) list.append(makeElement("li", "", renderItem(value)));
  addDetailSection(title, list);
}

function renderEntry(entry) {
  detailElement.replaceChildren();
  const top = makeElement("div", "detail-top");
  const heading = document.createElement("div");
  heading.append(
    makeElement("p", "eyebrow", kindNames[entry.kind] || "VERBETE"),
    makeElement("h2", "", entry.title),
    makeElement("p", "entry-meta", entry.category.name),
  );
  const close = makeElement("button", "detail-close", "Fechar");
  close.type = "button";
  close.setAttribute("aria-label", "Fechar detalhes");
  close.addEventListener("click", () => {
    detailElement.hidden = true;
    selectedSlug = "";
    for (const card of resultsElement.querySelectorAll(".entry-card")) {
      card.setAttribute("aria-current", "false");
      card.querySelector(".entry-title-button").setAttribute("aria-expanded", "false");
    }
  });
  top.append(heading, close);
  detailElement.append(top);

  addFormulaSection("Expressão", entry.expression);
  addFormulaSection("Resultado", entry.result);
  addTextSection("Condições de validade", entry.conditions);
  addTextSection("Observações", entry.notes);
  addListSection("Outras formas de escrita", entry.aliases);
  if (entry.notations.length) {
    const notations = document.createElement("ul");
    for (const notation of entry.notations) {
      const item = makeElement("li", "", `${notation.label}: `);
      if (notation.format === "latex") {
        item.append(makeFormula(notation.notation, false));
      } else {
        item.append(document.createTextNode(notation.notation));
      }
      notations.append(item);
    }
    addDetailSection("Notações", notations);
  }

  if (entry.examples.length) {
    const examples = document.createElement("div");
    for (const example of entry.examples) {
      const article = makeElement("article", "detail-section");
      article.append(
        makeElement("h3", "", example.title),
        makeElement("p", "", example.prompt),
        makeFormula(example.result),
      );
      if (example.steps.length) {
        const steps = document.createElement("ol");
        for (const step of example.steps) steps.append(makeElement("li", "", step));
        article.append(steps);
      }
      examples.append(article);
    }
    addDetailSection("Exemplos resolvidos", examples);
  }

  if (entry.applications.length) {
    const applications = document.createElement("div");
    for (const application of entry.applications) {
      const article = makeElement("article", "detail-section");
      article.append(
        makeElement("h3", "", application.title),
        makeElement("p", "", `${application.field}: ${application.description}`),
      );
      addTextTo(article, application.example);
      applications.append(article);
    }
    addDetailSection("Aplicações", applications);
  }

  addListSection("Condições detalhadas", entry.validityConditions, (condition) =>
    [condition.description, condition.predicate, condition.domain].filter(Boolean).join(" "),
  );
  addListSection("Verbetes relacionados", entry.relatedEntries, (related) =>
    `${related.title} (${related.relationType})`,
  );
  addSources(entry.sources.length ? entry.sources : [entry.source]);
  detailElement.hidden = false;
  detailElement.scrollIntoView({ block: "nearest" });
}

function addTextTo(parent, text) {
  if (text) parent.append(makeElement("p", "", text));
}

function addSources(sources) {
  if (!sources.length) return;
  const list = document.createElement("ul");
  for (const source of sources) {
    const item = document.createElement("li");
    item.append(makeElement("span", "", `${source.title}, ${source.publisher} (${source.license})`));
    try {
      const url = new URL(source.url);
      if (url.protocol === "https:") {
        const link = makeElement("a", "source-link", "Abrir referência");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(document.createElement("br"), link);
      }
    } catch {
      item.append(makeElement("p", "", "Endereço da referência indisponível."));
    }
    list.append(item);
  }
  addDetailSection("Referências", list);
}

async function showEntry(slug) {
  statusElement.textContent = "Carregando verbete…";
  try {
    const payload = await requestJson(`/api/v1/entries/${encodeURIComponent(slug)}`);
    selectedSlug = slug;
    for (const card of resultsElement.querySelectorAll(".entry-card")) {
      const button = card.querySelector(".entry-title-button");
      const isSelected = button.dataset.entrySlug === slug;
      card.setAttribute("aria-current", String(isSelected));
      button.setAttribute("aria-expanded", String(isSelected));
    }
    statusElement.textContent = "";
    renderEntry(payload.data);
  } catch (error) {
    statusElement.textContent = `Não foi possível carregar o verbete. ${error.message}`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  offset = 0;
  searchEntries();
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
  queryInput.focus();
  searchEntries();
});

try {
  await loadCategories();
  const health = await requestJson("/health");
  if (health.database === "not-configured") {
    demoNotice.textContent = "Modo de demonstração: catálogo limitado, sem conexão com o PostgreSQL.";
    demoNotice.hidden = false;
  }
  await searchEntries();
} catch (error) {
  statusElement.textContent = `Não foi possível iniciar o catálogo. ${error.message}`;
}
