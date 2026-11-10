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
