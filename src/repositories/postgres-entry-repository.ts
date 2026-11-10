import type { Pool } from "pg";
import type {
  Entry,
  EntryFilters,
  EntryPage,
  EntryRepository,
} from "../domain/entry.js";
import { normalizeSearchText } from "./search-normalization.js";

interface EntryRow {
  id: string;
  slug: string;
  title: string;
  kind: Entry["kind"];
  category_slug: string;
  category_name: string;
  expression: string;
  result: string;
  conditions: string;
  notes: string;
  source_title: string;
  source_url: string;
  publisher: string;
  license: string;
  accessed_on: string;
  aliases: string[];
  notations: Entry["notations"];
  examples: Entry["examples"];
  applications: Entry["applications"];
  validity_conditions: Entry["validityConditions"];
  sources: Entry["sources"];
  related_entries: Entry["relatedEntries"];
}

const ENTRY_SELECT = `
  SELECT e.id, e.slug, e.title, e.kind, e.category_slug, c.name AS category_name,
         e.expression, e.result, e.conditions, e.notes,
         s.title AS source_title, s.url AS source_url, s.publisher, s.license,
         s.accessed_on::text AS accessed_on,
         COALESCE((
           SELECT jsonb_agg(a.alias ORDER BY a.alias)
           FROM entry_aliases a
           WHERE a.entry_id = e.id
         ), '[]'::jsonb) AS aliases,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'label', n.label, 'format', n.format, 'notation', n.notation,
             'isPrimary', n.is_primary
           ) ORDER BY n.is_primary DESC, n.label, n.id)
           FROM entry_notations n
           WHERE n.entry_id = e.id
         ), '[]'::jsonb) AS notations,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'title', x.title, 'prompt', x.prompt, 'result', x.result, 'steps', x.steps
           ) ORDER BY x.sort_order, x.id)
           FROM entry_examples x
           WHERE x.entry_id = e.id
         ), '[]'::jsonb) AS examples,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'title', a.title, 'field', a.field_name,
             'description', a.description, 'example', a.example
           ) ORDER BY a.sort_order, a.id)
           FROM entry_applications a
           WHERE a.entry_id = e.id
         ), '[]'::jsonb) AS applications,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'description', v.description, 'predicate', v.predicate, 'domain', v.domain
           ) ORDER BY v.sort_order, v.id)
           FROM entry_validity_conditions v
           WHERE v.entry_id = e.id
         ), '[]'::jsonb) AS validity_conditions,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'title', additional.title, 'url', additional.url,
             'publisher', additional.publisher, 'license', additional.license,
             'accessedOn', additional.accessed_on::text
           ) ORDER BY es.role, additional.title)
           FROM entry_sources es
           JOIN sources additional ON additional.id = es.source_id
           WHERE es.entry_id = e.id
         ), '[]'::jsonb) AS sources,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'slug', related.slug, 'title', related.title, 'kind', related.kind,
             'relationType', r.relation_type
           ) ORDER BY r.relation_type, related.title)
           FROM entry_relations r
           JOIN entries related ON related.id = r.related_entry_id
           WHERE r.entry_id = e.id
         ), '[]'::jsonb) AS related_entries
  FROM entries e
  JOIN categories c ON c.slug = e.category_slug
  JOIN sources s ON s.id = e.source_id
`;

export class PostgresEntryRepository implements EntryRepository {
  constructor(private readonly pool: Pool) {}

  async search(filters: EntryFilters): Promise<EntryPage> {
    const where: string[] = [];
    const values: unknown[] = [];
    let searchProjection = "";
    let rankedSearch = false;

    if (filters.query) {
      const query = filters.query;
      const normalizedQuery = normalizeSearchText(query);
      values.push(query);
      const textParameter = `$${values.length}`;
      values.push(normalizedQuery);
      const normalizedParameter = `$${values.length}`;
      const normalizedEnabled = normalizedQuery.length > 0;
      const fuzzyEnabled = normalizedQuery.length >= 4;
      const fuzzyPredicate = fuzzyEnabled
        ? `OR (
             normalize_entry_search_text(e.title) % ${normalizedParameter}
             AND similarity(normalize_entry_search_text(e.title), ${normalizedParameter}) >= 0.4
           )
           OR (
             normalize_entry_search_text(e.slug) % ${normalizedParameter}
             AND similarity(normalize_entry_search_text(e.slug), ${normalizedParameter}) >= 0.4
           )
           OR EXISTS (
             SELECT 1 FROM entry_aliases fuzzy_alias
             WHERE fuzzy_alias.entry_id = e.id
               AND normalize_entry_search_text(fuzzy_alias.alias) % ${normalizedParameter}
               AND similarity(normalize_entry_search_text(fuzzy_alias.alias), ${normalizedParameter}) >= 0.4
           )`
        : "";
      const searchableConditions = [`
        e.title ILIKE '%' || ${textParameter} || '%'
        OR e.slug ILIKE '%' || ${textParameter} || '%'
        OR e.expression ILIKE '%' || ${textParameter} || '%'
        OR e.result ILIKE '%' || ${textParameter} || '%'
        OR e.conditions ILIKE '%' || ${textParameter} || '%'
        OR e.notes ILIKE '%' || ${textParameter} || '%'`,
        `EXISTS (
          SELECT 1 FROM entry_aliases a
          WHERE a.entry_id = e.id AND a.alias ILIKE '%' || ${textParameter} || '%'
        )`,
        `EXISTS (
          SELECT 1 FROM entry_notations n
          WHERE n.entry_id = e.id AND n.notation ILIKE '%' || ${textParameter} || '%'
        )`,
        `EXISTS (
          SELECT 1 FROM entry_examples x
          WHERE x.entry_id = e.id
            AND (x.title ILIKE '%' || ${textParameter} || '%'
              OR x.prompt ILIKE '%' || ${textParameter} || '%'
              OR x.result ILIKE '%' || ${textParameter} || '%'
              OR x.steps::text ILIKE '%' || ${textParameter} || '%')
        )`,
        `EXISTS (
          SELECT 1 FROM entry_applications a
          WHERE a.entry_id = e.id
            AND (a.title ILIKE '%' || ${textParameter} || '%'
              OR a.field_name ILIKE '%' || ${textParameter} || '%'
              OR a.description ILIKE '%' || ${textParameter} || '%'
              OR a.example ILIKE '%' || ${textParameter} || '%')
        )`,
      ];

      if (normalizedEnabled) {
        searchableConditions.push(`
          normalize_entry_search_text(e.title) LIKE '%' || ${normalizedParameter} || '%'
          OR normalize_entry_search_text(e.slug) LIKE '%' || ${normalizedParameter} || '%'
        OR EXISTS (
          SELECT 1 FROM entry_aliases a
          WHERE a.entry_id = e.id
            AND normalize_entry_search_text(a.alias) LIKE '%' || ${normalizedParameter} || '%'
        )
        OR EXISTS (
          SELECT 1 FROM entry_notations n
          WHERE n.entry_id = e.id
            AND normalize_entry_search_text(n.notation) LIKE '%' || ${normalizedParameter} || '%'
        )
        ${fuzzyPredicate}`);

        const similarity = `GREATEST(
          similarity(normalize_entry_search_text(e.title), ${normalizedParameter}),
          similarity(normalize_entry_search_text(e.slug), ${normalizedParameter}),
          COALESCE((
            SELECT MAX(similarity(normalize_entry_search_text(a.alias), ${normalizedParameter}))
            FROM entry_aliases a WHERE a.entry_id = e.id
          ), 0),
          0
        )`;
        const relevance = `CASE
          WHEN normalize_entry_search_text(e.title) = ${normalizedParameter}
            OR normalize_entry_search_text(e.slug) = ${normalizedParameter} THEN 0
          WHEN EXISTS (
            SELECT 1 FROM entry_aliases a
            WHERE a.entry_id = e.id
              AND normalize_entry_search_text(a.alias) = ${normalizedParameter}
          ) THEN 1
          WHEN EXISTS (
            SELECT 1 FROM entry_notations n
            WHERE n.entry_id = e.id
              AND normalize_entry_search_text(n.notation) = ${normalizedParameter}
          ) THEN 2
          WHEN normalize_entry_search_text(e.title) LIKE ${normalizedParameter} || '%'
            OR EXISTS (
              SELECT 1 FROM entry_aliases a
              WHERE a.entry_id = e.id
                AND normalize_entry_search_text(a.alias) LIKE ${normalizedParameter} || '%'
            )
            OR EXISTS (
              SELECT 1 FROM entry_notations n
              WHERE n.entry_id = e.id
                AND normalize_entry_search_text(n.notation) LIKE ${normalizedParameter} || '%'
            ) THEN 3
          ELSE 4
        END`;
        searchProjection = `${relevance} AS search_relevance, ${similarity} AS search_similarity,`;
        rankedSearch = true;
      }

      where.push(`(${searchableConditions.map((condition) => `(${condition})`).join(" OR ")})`);
    }
    if (filters.kind) {
      values.push(filters.kind);
      where.push(`e.kind = $${values.length}`);
    }
    if (filters.category) {
      values.push(filters.category);
      where.push(`e.category_slug = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM entries e ${whereClause}`,
      values,
    );
    const countRow = countResult.rows[0];
    if (!countRow) {
      throw new Error("A consulta de total não retornou uma linha.");
    }

    const pageValues = [...values, filters.limit, filters.offset];
    const rowsResult = await this.pool.query<EntryRow>(
      `${searchProjection
        ? ENTRY_SELECT.replace("SELECT e.id", `SELECT ${searchProjection} e.id`)
        : ENTRY_SELECT}
       ${whereClause}
       ORDER BY ${rankedSearch ? "search_relevance ASC, search_similarity DESC, " : ""}e.title ASC, e.slug ASC
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );

    return {
      items: rowsResult.rows.map(mapEntry),
      total: Number(countRow.total),
    };
  }

  async findBySlug(slug: string): Promise<Entry | null> {
    const result = await this.pool.query<EntryRow>(
      `${ENTRY_SELECT} WHERE e.slug = $1`,
      [slug],
    );
    const row = result.rows[0];
    return row ? mapEntry(row) : null;
  }

  async listCategories() {
    const result = await this.pool.query<{
      slug: string;
      name: string;
      description: string;
    }>(
      "SELECT slug, name, description FROM categories ORDER BY name ASC",
    );
    return result.rows;
  }
}

function mapEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    category: {
      slug: row.category_slug,
      name: row.category_name,
    },
    expression: row.expression,
    result: row.result,
    conditions: row.conditions,
    notes: row.notes,
    source: {
      title: row.source_title,
      url: row.source_url,
      publisher: row.publisher,
      license: row.license,
      accessedOn: row.accessed_on,
    },
    aliases: row.aliases,
    notations: row.notations,
    examples: row.examples,
    applications: row.applications,
    validityConditions: row.validity_conditions,
    sources: row.sources,
    relatedEntries: row.related_entries,
  };
}
