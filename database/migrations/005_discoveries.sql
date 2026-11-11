CREATE TABLE discoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('quanta', 'openalex')),
    external_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    original_title TEXT NOT NULL,
    authors TEXT[] NOT NULL DEFAULT '{}',
    published_at TIMESTAMPTZ,
    source_summary TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'review', 'approved', 'rejected')),
    editorial_title TEXT,
    editorial_summary TEXT,
    topic TEXT CHECK (
        topic IS NULL OR topic IN (
            'mathematics', 'statistics', 'probability', 'computing',
            'physics', 'economics', 'other'
        )
    ),
    difficulty TEXT CHECK (
        difficulty IS NULL OR difficulty IN ('introductory', 'intermediate', 'advanced')
    ),
    facets JSONB NOT NULL DEFAULT '[]'::jsonb,
    justification TEXT,
    relevance_score SMALLINT CHECK (relevance_score IS NULL OR relevance_score BETWEEN 0 AND 100),
    confidence NUMERIC(4, 3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
    durable BOOLEAN NOT NULL DEFAULT FALSE,
    related_entry_slugs TEXT[] NOT NULL DEFAULT '{}',
    rejection_reason TEXT,
    curated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, external_id),
    CHECK (
        status <> 'approved' OR (
            editorial_title IS NOT NULL AND editorial_summary IS NOT NULL
            AND topic IS NOT NULL AND difficulty IS NOT NULL
            AND justification IS NOT NULL AND relevance_score IS NOT NULL
            AND confidence IS NOT NULL AND curated_at IS NOT NULL
        )
    )
);

CREATE INDEX discoveries_approved_feed_idx
    ON discoveries (durable, published_at DESC, curated_at DESC)
    WHERE status = 'approved';

CREATE INDEX discoveries_pending_idx
    ON discoveries (published_at DESC NULLS LAST, created_at DESC)
    WHERE status = 'pending';

CREATE TABLE discovery_ai_usage (
    usage_day DATE PRIMARY KEY,
    request_count SMALLINT NOT NULL CHECK (request_count BETWEEN 1 AND 8),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
