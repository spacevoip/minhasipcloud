-- 017_cdr_terminations_indexes.sql
-- Purpose: Indexes to optimize /api/terminations queries
-- - CDR tables: calldate (filter/order), accountcode (RBAC filter), dstchannel (ILIKE prefix)
-- - Trunks: ps_endpoint_id_ips.name (lookup by name)
--
-- This migration is defensive: it applies indexes to any existing CDR table
-- among: cdr_pabx, calls_pabx, cdr. It also avoids creating duplicates.

BEGIN;

-- Ensure pg_trgm extension for efficient ILIKE and text search (safe no-op if exists)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Helper function to create indexes for a given table if it exists
DO $$
DECLARE
  t TEXT;
  idx_name TEXT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['cdr_pabx','calls_pabx','cdr'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- calldate btree index
      idx_name := format('%I_calldate_idx', tbl);
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'i' AND c.relname = idx_name AND n.nspname = 'public'
      ) THEN
        EXECUTE format('CREATE INDEX %I ON %I (calldate DESC);', idx_name, tbl);
      END IF;

      -- accountcode btree index
      idx_name := format('%I_accountcode_idx', tbl);
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'i' AND c.relname = idx_name AND n.nspname = 'public'
      ) THEN
        EXECUTE format('CREATE INDEX %I ON %I (accountcode);', idx_name, tbl);
      END IF;

      -- dstchannel case-insensitive prefix search support
      -- We use a functional index on lower(dstchannel) with text_pattern_ops to enable
      -- ILIKE/LOWER(... ) LIKE 'prefix%'
      idx_name := format('%I_lower_dstchannel_like_idx', tbl);
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'i' AND c.relname = idx_name AND n.nspname = 'public'
      ) THEN
        EXECUTE format('CREATE INDEX %I ON %I (lower(dstchannel) varchar_pattern_ops);', idx_name, tbl);
      END IF;

      -- Optional: trigram index for general ILIKE searches on dstchannel
      -- This helps when queries are not strictly prefix-based or when planner prefers it.
      idx_name := format('%I_dstchannel_trgm_idx', tbl);
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'i' AND c.relname = idx_name AND n.nspname = 'public'
      ) THEN
        EXECUTE format('CREATE INDEX %I ON %I USING gin (dstchannel gin_trgm_ops);', idx_name, tbl);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Trunks table index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ps_endpoint_id_ips'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i' AND c.relname = 'ps_endpoint_id_ips_name_idx' AND n.nspname = 'public'
    ) THEN
      CREATE INDEX ps_endpoint_id_ips_name_idx ON ps_endpoint_id_ips (name);
    END IF;
  END IF;
END $$;

COMMIT;
