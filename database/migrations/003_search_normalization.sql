CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION normalize_entry_search_text(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
DECLARE
    normalized TEXT := LOWER(input);
BEGIN
    normalized := REPLACE(normalized, E'\\displaystyle', ' ');
    normalized := REPLACE(normalized, E'\\int', ' integral ');
    normalized := REPLACE(normalized, E'\\left', ' ');
    normalized := REPLACE(normalized, E'\\right', ' ');
    normalized := REPLACE(normalized, E'\\quad', ' ');
    normalized := REPLACE(normalized, E'\\qquad', ' ');
    normalized := REPLACE(normalized, E'\\cdot', ' vezes ');
    normalized := REPLACE(normalized, E'\\times', ' vezes ');
    normalized := REPLACE(normalized, E'\\sqrt', ' sqrt ');
    normalized := REPLACE(normalized, E'\\pi', ' pi ');
    normalized := REPLACE(normalized, '∫', ' integral ');
    normalized := REPLACE(normalized, 'π', ' pi ');
    normalized := REPLACE(normalized, '√', ' sqrt ');
    normalized := REPLACE(normalized, '×', ' vezes ');
    normalized := REPLACE(normalized, '·', ' vezes ');
    normalized := TRANSLATE(
        normalized,
        'áàâãäéèêëíìîïóòôõöúùûüç²³',
        'aaaaaeeeeiiiiooooouuuuc23'
    );
    RETURN REGEXP_REPLACE(normalized, '[^a-z0-9]+', '', 'g');
END;
$$;

CREATE INDEX IF NOT EXISTS entries_title_normalized_trgm_idx
    ON entries USING GIN (normalize_entry_search_text(title) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS entries_slug_normalized_trgm_idx
    ON entries USING GIN (normalize_entry_search_text(slug) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS entry_aliases_normalized_trgm_idx
    ON entry_aliases USING GIN (normalize_entry_search_text(alias) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS entry_notations_normalized_trgm_idx
    ON entry_notations USING GIN (normalize_entry_search_text(notation) gin_trgm_ops);
