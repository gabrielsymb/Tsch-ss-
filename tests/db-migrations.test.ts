import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { Pool } from "pg";
import { PostgresEntryRepository } from "../src/repositories/postgres-entry-repository.js";
import { applyMigrations } from "../src/scripts/migrations.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

if (process.env.CI === "true" && !databaseUrl) {
  throw new Error("TEST_DATABASE_URL é obrigatória para executar a integração PostgreSQL no CI.");
}

test(
  "adopts an existing schema without losing data and records migrations once",
  { skip: !databaseUrl && "Set TEST_DATABASE_URL to run PostgreSQL integration tests." },
  async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    const schema = `migration_test_${randomUUID().replaceAll("-", "")}`;
    let schemaCreated = false;
    let scopedPool: Pool | undefined;

    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
      await client.query(`SET search_path TO "${schema}"`);

      const initialSchema = await readFile(
        resolve("database/migrations/001_initial_schema.sql"),
        "utf8",
      );
      await client.query(initialSchema);
      await client.query(`
        INSERT INTO sources (title, url, publisher, license, accessed_on)
        VALUES ('Existing source', 'https://example.test/existing', 'Test', 'CC0', DATE '2026-01-01')
      `);
      await client.query(`
        INSERT INTO categories (slug, name, description)
        VALUES ('existing', 'Existing category', 'Preserved test data')
      `);
      await client.query(`
        INSERT INTO entries (
          slug, title, kind, category_slug, expression, result, conditions, source_id
        )
        SELECT 'existing-entry', 'Existing entry', 'integral', 'existing',
               '\\int x\\,dx', 'x^2/2+C', 'x pertence ao domínio real considerado.', id
        FROM sources
        WHERE url = 'https://example.test/existing'
      `);

      assert.equal(await applyMigrations(client, resolve("database/migrations")), 3);
      assert.equal(await applyMigrations(client, resolve("database/migrations")), 0);

      await client.query(`
        INSERT INTO entry_aliases (entry_id, alias)
        SELECT id, 'legacy alias' FROM entries WHERE slug = 'existing-entry'
      `);
      await client.query(`
        INSERT INTO entry_notations (entry_id, label, format, notation)
        SELECT id, 'Unicode notation', 'unicode', '∫ x dx'
        FROM entries WHERE slug = 'existing-entry'
      `);
      await client.query(`
        INSERT INTO entry_examples (entry_id, title, prompt, result, steps)
        SELECT id, 'Test example', 'Find an antiderivative.',
               'x^2/2+C', ARRAY['Apply the power rule.']
        FROM entries WHERE slug = 'existing-entry'
      `);
      await client.query(`
        INSERT INTO entry_applications (entry_id, title, field_name, description, example)
        SELECT id, 'Test application', 'Physics', 'A test application.', 's(t)=t^2'
        FROM entries WHERE slug = 'existing-entry'
      `);
      await client.query(`
        INSERT INTO entries (
          slug, title, kind, category_slug, expression, result, source_id
        )
        SELECT 'related-entry', 'Related entry', 'derivative', 'existing',
               'f(x)=x', 'f''(x)=1', id
        FROM sources WHERE url = 'https://example.test/existing'
      `);
      await client.query(`
        INSERT INTO entries (
          slug, title, kind, category_slug, expression, result, source_id
        )
        SELECT 'alias-title-match', 'Legacy alias example', 'integral', 'existing',
               'x', 'x', id
        FROM sources WHERE url = 'https://example.test/existing'
      `);
      await client.query(`
        INSERT INTO entry_relations (entry_id, related_entry_id, relation_type)
        SELECT entry.id, related.id, 'related'
        FROM entries entry, entries related
        WHERE entry.slug = 'existing-entry' AND related.slug = 'related-entry'
      `);

      scopedPool = new Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${schema}`,
      });
      const repository = new PostgresEntryRepository(scopedPool);
      const notationPage = await repository.search({
        query: "∫ x dx",
        limit: 20,
        offset: 0,
      });
      assert.equal(notationPage.total, 1);
      assert.equal(notationPage.items[0]?.slug, "existing-entry");

      const page = await repository.search({
        query: "legacy alias",
        limit: 1,
        offset: 0,
      });
      assert.equal(page.total, 2);
      assert.equal(page.items[0]?.slug, "existing-entry");
      assert.deepEqual(page.items[0]?.aliases, ["legacy alias"]);
      assert.equal(page.items[0]?.notations[0]?.isPrimary, true);
      assert.equal(page.items[0]?.examples[0]?.result, "x^2/2+C");
      assert.deepEqual(page.items[0]?.examples[0]?.steps, ["Apply the power rule."]);
      assert.equal(page.items[0]?.applications[0]?.field, "Physics");
      assert.equal(
        page.items[0]?.validityConditions[0]?.description,
        "x pertence ao domínio real considerado.",
      );
      assert.equal(page.items[0]?.sources[0]?.title, "Existing source");
      assert.deepEqual(page.items[0]?.relatedEntries, [{
        slug: "related-entry",
        title: "Related entry",
        kind: "derivative",
        relationType: "related",
      }]);
      const secondPage = await repository.search({
        query: "legacy alias",
        limit: 1,
        offset: 1,
      });
      assert.equal(secondPage.total, 2);
      assert.equal(secondPage.items.length, 1);
      assert.equal(secondPage.items[0]?.slug, "alias-title-match");

      const typoPage = await repository.search({
        query: "legacy alais",
        limit: 20,
        offset: 0,
      });
      assert.equal(typoPage.items[0]?.slug, "existing-entry");

      const entry = await repository.findBySlug("existing-entry");
      assert.equal(entry?.title, "Existing entry");
    } finally {
      await scopedPool?.end();
      if (schemaCreated) {
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      }
      client.release();
      await pool.end();
    }
  },
);
