import type { Pool } from "pg";
import type {
  CuratedDiscovery,
  DiscoveryCandidate,
  DiscoveryFilters,
  DiscoveryPage,
  DiscoveryRepository,
  DiscoveryAssessment,
  DiscoveryFacet,
  DiscoverySource,
  DiscoveryTopic,
  DiscoveryDifficulty,
} from "../domain/discovery.js";

interface CandidateRow {
  id: string;
  source: DiscoverySource;
  external_id: string;
  source_name: string;
  source_url: string;
  original_title: string;
  authors: string[];
  published_at: string | null;
  source_summary: string;
  metadata: Record<string, unknown>;
}

interface DiscoveryRow extends CandidateRow {
  editorial_title: string;
  editorial_summary: string;
  topic: DiscoveryTopic;
  difficulty: DiscoveryDifficulty;
  facets: DiscoveryFacet[];
  justification: string;
  relevance_score: number;
  confidence: number;
  durable: boolean;
  related_entry_slugs: string[];
}

export class PostgresDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly pool: Pool) {}

  async saveCandidates(candidates: DiscoveryCandidate[]): Promise<number> {
    let inserted = 0;
    for (const candidate of candidates) {
      const result = await this.pool.query(
        `INSERT INTO discoveries (
           source, external_id, source_name, source_url, original_title,
           authors, published_at, source_summary, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9::jsonb)
         ON CONFLICT (source, external_id) DO UPDATE SET
           source_name = EXCLUDED.source_name,
           source_url = EXCLUDED.source_url,
           original_title = EXCLUDED.original_title,
           authors = EXCLUDED.authors,
           published_at = EXCLUDED.published_at,
           source_summary = EXCLUDED.source_summary,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         WHERE discoveries.status IN ('pending', 'review')
         RETURNING (xmax = 0) AS was_inserted`,
        [
          candidate.source,
          candidate.externalId,
          candidate.sourceName,
          candidate.sourceUrl,
          candidate.originalTitle,
          candidate.authors,
          candidate.publishedAt,
          candidate.sourceSummary,
          JSON.stringify(candidate.metadata),
        ],
      );
      if (result.rows[0]?.was_inserted === true) inserted += 1;
    }
    return inserted;
  }

  async listPending(limit: number): Promise<Array<DiscoveryCandidate & { id: string }>> {
    const result = await this.pool.query<CandidateRow>(
      `SELECT id, source, external_id, source_name, source_url, original_title,
              authors, published_at::text, source_summary, metadata
       FROM discoveries
       WHERE status = 'pending'
       ORDER BY created_at ASC, published_at DESC NULLS LAST
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapCandidate);
  }

  async reserveAiRequest(day: string, dailyLimit: number): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO discovery_ai_usage (usage_day, request_count)
       VALUES ($1::date, 1)
       ON CONFLICT (usage_day) DO UPDATE
       SET request_count = discovery_ai_usage.request_count + 1,
           updated_at = NOW()
       WHERE discovery_ai_usage.request_count < $2
       RETURNING request_count`,
      [day, dailyLimit],
    );
    return result.rowCount === 1;
  }

  async listDictionaryEntries() {
    const result = await this.pool.query<{
      slug: string;
      title: string;
      category_slug: string;
    }>(
      `SELECT e.slug, e.title, e.category_slug
       FROM entries e
       ORDER BY e.title
       LIMIT 250`,
    );
    return result.rows.map(({ slug, title, category_slug }) => ({
      slug,
      title,
      category: category_slug,
    }));
  }

  async approve(id: string, assessment: DiscoveryAssessment): Promise<void> {
    await this.pool.query(
      `UPDATE discoveries
       SET status = 'approved', editorial_title = $2, editorial_summary = $3,
           topic = $4, difficulty = $5, facets = $6::jsonb,
           justification = $7, relevance_score = $8, confidence = $9,
           durable = $10, related_entry_slugs = $11, rejection_reason = NULL,
           curated_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'review')`,
      [
        id,
        assessment.title,
        assessment.summary,
        assessment.topic,
        assessment.difficulty,
        JSON.stringify(assessment.facets),
        assessment.justification,
        assessment.relevanceScore,
        assessment.confidence,
        assessment.durable,
        assessment.relatedEntrySlugs,
      ],
    );
  }

  async reject(id: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE discoveries
       SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'review')`,
      [id, reason],
    );
  }

  async flagForReview(id: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE discoveries
       SET status = 'review', rejection_reason = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [id, reason],
    );
  }

  async listApproved(filters: DiscoveryFilters): Promise<DiscoveryPage> {
    const values: unknown[] = [];
    const topicFilter = filters.topic
      ? `AND topic = $${values.push(filters.topic)}`
      : "";
    const countResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM discoveries
       WHERE status = 'approved' ${topicFilter}`,
      values,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    const pageValues = [...values, filters.limit, filters.offset];
    const result = await this.pool.query<DiscoveryRow>(
      `WITH approved AS (
         SELECT id, source, external_id, source_name, source_url, original_title,
                authors, published_at::text, source_summary, metadata,
                editorial_title, editorial_summary, topic, difficulty, facets,
                justification, relevance_score, confidence::float8 AS confidence,
                durable, related_entry_slugs,
                ROW_NUMBER() OVER (
                  PARTITION BY durable
                  ORDER BY published_at DESC NULLS LAST, curated_at DESC, id
                ) AS mix_order
         FROM discoveries
         WHERE status = 'approved' ${topicFilter}
       )
       SELECT *
       FROM approved
       ORDER BY CASE WHEN durable THEN mix_order * 2 ELSE mix_order * 2 - 1 END,
                id
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );

    return { items: result.rows.map(mapDiscovery), total };
  }
}

function mapCandidate(row: CandidateRow): DiscoveryCandidate & { id: string } {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    originalTitle: row.original_title,
    authors: row.authors,
    publishedAt: row.published_at,
    sourceSummary: row.source_summary,
    metadata: row.metadata,
  };
}

function mapDiscovery(row: DiscoveryRow): CuratedDiscovery {
  return {
    id: row.id,
    originalTitle: row.original_title,
    title: row.editorial_title,
    summary: row.editorial_summary,
    source: row.source,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    authors: row.authors,
    publishedAt: row.published_at,
    topic: row.topic,
    difficulty: row.difficulty,
    facets: row.facets,
    justification: row.justification,
    relevanceScore: row.relevance_score,
    confidence: row.confidence,
    durable: row.durable,
    relatedEntrySlugs: row.related_entry_slugs,
  };
}
