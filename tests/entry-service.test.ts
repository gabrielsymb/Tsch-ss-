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

test("accepts reference table filters", async () => {
  const repository = createRepository();
  const service = new EntryService(repository);

  await service.search({ kind: "reference" });

  assert.deepEqual(repository.receivedFilters, {
    kind: "reference",
    limit: 20,
    offset: 0,
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
  assert.equal(result.items[0]?.notes, "");
});

test("demo repository finds the chain rule by name and alias", async () => {
  const repository = new DemoEntryRepository();
  for (const query of ["cadeia", "regra da cadeia", "chain rule"]) {
    const result = await repository.search({ query, limit: 20, offset: 0 });
    assert.equal(result.items[0]?.slug, "derivative-chain-rule-demo");
  }
});

test("demo repository searches the reference tables", async () => {
  const repository = new DemoEntryRepository();
  const integrals = await repository.search({
    query: "integrais imediatas",
    limit: 20,
    offset: 0,
  });
  assert.equal(integrals.items[0]?.kind, "reference");
  assert.equal(integrals.items[0]?.slug, "integral-immediate-reference-demo");
  assert.equal(integrals.items[0]?.examples.length, 17);
  assert.doesNotMatch(integrals.items[0]?.examples[1]?.prompt ?? "", /\\/);
  assert.match(integrals.items[0]?.examples[1]?.result ?? "", /\\int x\^n/);
  assert.match(integrals.items[0]?.examples[5]?.result ?? "", /\\int\\sin\(x\)/);

  const angles = await repository.search({
    query: "ângulos notáveis",
    limit: 20,
    offset: 0,
  });
  assert.equal(angles.items[0]?.slug, "notable-angles-reference-demo");
  assert.equal(angles.items[0]?.examples.length, 5);
  assert.equal(angles.items[0]?.examples[1]?.prompt, "π/6 rad");
  assert.doesNotMatch(angles.items[0]?.conditions ?? "", /\\/);
  assert.doesNotMatch(angles.items[0]?.notes ?? "", /\\/);
  assert.deepEqual(angles.items[0]?.examples[4]?.steps, [
    "sen(90°) = 1",
    "cos(90°) = 0",
    "tan(90°) = indefinida",
  ]);
  assert.equal(
    angles.items[0]?.source.url,
    "https://openstax.org/books/precalculus-2e/pages/5-2-unit-circle-sine-and-cosine-functions",
  );
});

test("demo repository marks inline mathematics in prose for rendering", async () => {
  const repository = new DemoEntryRepository();
  const { items } = await repository.search({
    limit: 100,
    offset: 0,
  });
  const prose = items.flatMap((entry) => [
    entry.conditions,
    entry.notes,
    ...entry.validityConditions.flatMap((condition) => [
      condition.description,
      condition.predicate,
      condition.domain,
    ]),
    ...entry.examples.flatMap((example) => [
      example.prompt,
      ...example.steps,
    ]),
    ...entry.applications.flatMap((application) => [
      application.description,
      application.example,
    ]),
  ]);

  for (const text of prose) {
    const unmarkedText = text.replace(/\\\([\s\S]*?\\\)/g, "");
    assert.doesNotMatch(unmarkedText, /\\[a-zA-Z]+/, `LaTeX sem marcação: ${text}`);
  }
});

test("demo repository normalizes notation and ranks exact matches before fuzzy matches", async () => {
  const repository = new DemoEntryRepository();
  const notationMatch = await repository.search({
    query: "\\int e^x dx",
    limit: 20,
    offset: 0,
  });
  assert.equal(notationMatch.items[0]?.slug, "integral-exponential-e-demo");
  assert.ok(notationMatch.items.some(
    (entry) => entry.slug === "integral-immediate-reference-demo",
  ));

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

  assert.equal(firstPage.total, 3);
  assert.equal(secondPage.total, 3);
  assert.equal(firstPage.items.length, 1);
  assert.equal(secondPage.items.length, 1);
  assert.notEqual(firstPage.items[0]?.slug, secondPage.items[0]?.slug);
});
