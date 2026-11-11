import assert from "node:assert/strict";
import test from "node:test";
import type {
  EntryFilters,
  EntryPage,
  EntryRepository,
} from "../src/domain/entry.js";
import { buildApp } from "../src/app.js";

class TestRepository implements EntryRepository {
  receivedFilters: EntryFilters | undefined;

  async search(filters: EntryFilters): Promise<EntryPage> {
    this.receivedFilters = filters;
    return { items: [], total: 0 };
  }

  async findBySlug() {
    return null;
  }

  async listCategories() {
    return [{ slug: "algebraic", name: "Algébricas", description: "Regras algébricas." }];
  }
}

test("entry search endpoint returns paginated JSON", async () => {
  const repository = new TestRepository();
  const app = await buildApp({
    repository,
    checkDatabase: async () => {},
    logger: false,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/entries?q=exp&kind=integral&limit=5",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      data: [],
      pagination: { limit: 5, offset: 0, total: 0 },
    });
    assert.deepEqual(repository.receivedFilters, {
      query: "exp",
      kind: "integral",
      limit: 5,
      offset: 0,
    });
  } finally {
    await app.close();
  }
});

test("entry search endpoint accepts reference-table filtering", async () => {
  const repository = new TestRepository();
  const app = await buildApp({
    repository,
    checkDatabase: async () => {},
    logger: false,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/entries?kind=reference",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(repository.receivedFilters?.kind, "reference");
  } finally {
    await app.close();
  }
});

test("entry search endpoint reports invalid query parameters", async () => {
  const app = await buildApp({
    repository: new TestRepository(),
    checkDatabase: async () => {},
    logger: false,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/entries?kind=unknown",
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_query");

    const repeatedParameter = await app.inject({
      method: "GET",
      url: "/api/v1/entries?q=first&q=second",
    });

    assert.equal(repeatedParameter.statusCode, 400);
    assert.equal(repeatedParameter.json().error, "invalid_query");
  } finally {
    await app.close();
  }
});

test("serves the mobile-friendly Tschüss interface and its local assets", async () => {
  const app = await buildApp({
    repository: new TestRepository(),
    logger: false,
  });

  try {
    const page = await app.inject({ method: "GET", url: "/" });
    assert.equal(page.statusCode, 200);
    assert.match(page.headers["content-type"] ?? "", /text\/html/);
    assert.match(page.body, /name="viewport"/);
    assert.match(page.body, /<title>Tschüss<\/title>/);
    assert.match(page.body, /\/icons\/tchuss\.svg/);
    assert.match(page.body, /id="toggle-filters"/);
    assert.match(page.body, /\/icons\/filter\.svg/);
    assert.match(page.body, /<h1 id="welcome-title">Pesquise no catálogo<\/h1>/);
    assert.match(page.body, /id="discoveries"/);
    assert.match(page.body, /Descobertas/);
    assert.match(page.body, /id="confirm-discovery-age"/);
    assert.match(page.body, /id="search-panel"[^>]*hidden/);
    assert.match(page.body, /id="content-layout"[^>]*hidden/);
    assert.match(page.body, /Resultados da busca/);
    assert.doesNotMatch(page.body, /id="result-count"/);
    assert.match(page.body, /<form id="search-form" class="top-search" role="search">/);
    assert.match(page.body, /id="query"/);
    assert.match(page.body, /type="text"/);
    assert.doesNotMatch(page.body, /type="search"/);
    assert.match(page.body, /id="suggestions"/);
    assert.match(page.body, /aria-autocomplete="list"/);
    assert.match(page.body, /\/katex\/katex\.min\.css/);
    assert.match(page.body, /\/katex\/katex\.min\.js/);

    const stylesheet = await app.inject({ method: "GET", url: "/styles.css" });
    assert.equal(stylesheet.statusCode, 200);
    assert.match(stylesheet.headers["content-type"] ?? "", /text\/css/);
    assert.match(stylesheet.body, /:focus-visible/);
    assert.match(stylesheet.body, /position:\s*sticky/);

    const script = await app.inject({ method: "GET", url: "/app.js" });
    assert.equal(script.statusCode, 200);
    assert.match(script.headers["content-type"] ?? "", /javascript/);

    const discoveries = await app.inject({
      method: "GET",
      url: "/api/v1/discoveries",
    });
    assert.equal(discoveries.statusCode, 200);
    assert.match(discoveries.headers["cache-control"] ?? "", /no-store/);
    assert.deepEqual(discoveries.json(), {
      data: [],
      pagination: { limit: 4, offset: 0, total: 0 },
    });

    const favicon = await app.inject({ method: "GET", url: "/favicon.svg" });
    assert.equal(favicon.statusCode, 200);
    assert.match(favicon.headers["content-type"] ?? "", /image\/svg\+xml/);

    const appIcon = await app.inject({ method: "GET", url: "/icons/tchuss.svg" });
    assert.equal(appIcon.statusCode, 200);
    assert.match(appIcon.headers["content-type"] ?? "", /image\/svg\+xml/);

    const filterIcon = await app.inject({ method: "GET", url: "/icons/filter.svg" });
    assert.equal(filterIcon.statusCode, 200);
    assert.match(filterIcon.headers["content-type"] ?? "", /image\/svg\+xml/);

    const katexStylesheet = await app.inject({ method: "GET", url: "/katex/katex.min.css" });
    assert.equal(katexStylesheet.statusCode, 200);
    assert.match(katexStylesheet.headers["content-type"] ?? "", /text\/css/);
    assert.match(katexStylesheet.body, /fonts\/KaTeX_Main-Regular\.woff2/);

    const katexScript = await app.inject({ method: "GET", url: "/katex/katex.min.js" });
    assert.equal(katexScript.statusCode, 200);
    assert.match(katexScript.headers["content-type"] ?? "", /javascript/);

    const katexFont = await app.inject({
      method: "GET",
      url: "/katex/fonts/KaTeX_Main-Regular.woff2",
    });
    assert.equal(katexFont.statusCode, 200);
    assert.match(katexFont.headers["content-type"] ?? "", /font\/woff2/);
  } finally {
    await app.close();
  }
});
