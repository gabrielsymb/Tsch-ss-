ALTER TABLE entries
    DROP CONSTRAINT IF EXISTS entries_kind_check;

ALTER TABLE entries
    ADD CONSTRAINT entries_kind_check
    CHECK (kind IN ('derivative', 'integral', 'technique', 'reference'));
