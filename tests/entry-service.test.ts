import assert from "node:assert/strict";
import test from "node:test";
import type {
  EntryFilters,
  EntryPage,
  EntryRepository,
} from "../src/domain/entry.js";
import { DemoEntryRepository } from "../src/repositories/demo-entry-repository.js";
import {
  EntryService,
  InvalidQueryError,
} from "../src/services/entry-service.js";

function createRepository(): EntryRepository & {
  receivedFilters?: EntryFilters;
} {
  return {
    async search(filters): Promise<EntryPage> {
      this.receivedFilters = filters;
      return { items: [], total: 0 };
    },
    async findBySlug() {
      return null;
    },
    async listCategories() {
      return [];
    },
  };
}

test("uses default pagination and trims a text search", async () => {
  const repository = createRepository();
  const service = new EntryService(repository);

  await service.search({ q: "  exp  " });

  assert.deepEqual(repository.receivedFilters, {
    query: "exp",
    limit: 20,
    offset: 0,
  });
});

test("accepts supported filters", async () => {
  const repository = createRepository();
  const service = new EntryService(repository);

  await service.search({
    kind: "integral",
    category: "exponential-logarithmic",
    limit: "50",
    offset: "10",
  });

  assert.deepEqual(repository.receivedFilters, {
    kind: "integral",
    category: "exponential-logarithmic",
    limit: 50,
    offset: 10,
  });
});

test("rejects invalid filters instead of silently ignoring them", async () => {
  const service = new EntryService(createRepository());

  await assert.rejects(
    service.search({ kind: "unknown" }),
    InvalidQueryError,
  );
  await assert.rejects(
    service.search({ limit: "101" }),
    InvalidQueryError,
  );
  await assert.rejects(
    service.search({ offset: "-1" }),
    InvalidQueryError,
  );
});

test("demo repository searches aliases and returns structured entry fields", async () => {
  const service = new EntryService(new DemoEntryRepository());
  const result = await service.search({ q: "power rule" });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.slug, "derivative-power-demo");
  assert.deepEqual(result.items[0]?.aliases, ["regra da potência", "power rule"]);
  assert.equal(result.items[0]?.notations[0]?.format, "latex");
  assert.deepEqual(result.items[0]?.examples, []);
});

test("demo repository normalizes notation and ranks exact matches before fuzzy matches", async () => {
  const repository = new DemoEntryRepository();
  const notationMatch = await repository.search({
    query: "\\int e^x dx",
    limit: 20,
    offset: 0,
  });
  assert.deepEqual(notationMatch.items.map((entry) => entry.slug), [
    "integral-exponential-e-demo",
  ]);

  const typoMatch = await repository.search({
    query: "integracao por partez",
    limit: 20,
    offset: 0,
  });
  assert.equal(typoMatch.items[0]?.slug, "integration-by-parts-demo");

  const exactAliasFirst = await repository.search({
    query: "regra da potencia",
    limit: 20,
    offset: 0,
  });
  assert.equal(exactAliasFirst.items[0]?.slug, "derivative-power-demo");
});

test("demo repository paginates ranked results without duplicate entries", async () => {
  const repository = new DemoEntryRepository();
  const firstPage = await repository.search({
    query: "integral",
    limit: 1,
    offset: 0,
  });
  const secondPage = await repository.search({
    query: "integral",
    limit: 1,
    offset: 1,
  });

  assert.equal(firstPage.total, 2);
  assert.equal(secondPage.total, 2);
  assert.equal(firstPage.items.length, 1);
  assert.equal(secondPage.items.length, 1);
  assert.notEqual(firstPage.items[0]?.slug, secondPage.items[0]?.slug);
});
