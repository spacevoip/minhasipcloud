-- Optimize filtering and search on planos_pabx and users_pabx
-- Safe to run multiple times

BEGIN;

-- Enable pg_trgm for fast ILIKE searches (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- planos_pabx equality filters
CREATE INDEX IF NOT EXISTS idx_planos_pabx_status ON planos_pabx (status);
CREATE INDEX IF NOT EXISTS idx_planos_pabx_created_by ON planos_pabx (created_by);
CREATE INDEX IF NOT EXISTS idx_planos_pabx_reseller_id ON planos_pabx (reseller_id);

-- Common composite filters with pagination ordering
-- Adjust based on your typical WHERE + ORDER BY usage
CREATE INDEX IF NOT EXISTS idx_planos_pabx_reseller_status_created_at
  ON planos_pabx (reseller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_planos_pabx_created_by_status_created_at
  ON planos_pabx (created_by, status, created_at DESC);

-- If sorting by updated_at is also common
CREATE INDEX IF NOT EXISTS idx_planos_pabx_updated_at ON planos_pabx (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_planos_pabx_created_at ON planos_pabx (created_at DESC);

-- Search support (ILIKE on name and/or slug)
CREATE INDEX IF NOT EXISTS idx_planos_pabx_name_trgm
  ON planos_pabx USING gin (name gin_trgm_ops);

-- If slug exists and is searched
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'planos_pabx' AND column_name = 'slug'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_planos_pabx_slug_trgm ON planos_pabx USING gin (slug gin_trgm_ops)';
  END IF;
END$$;

-- users_pabx counts per plan
CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_id ON users_pabx (plan_id);

-- Optional: if filtering user status is common in counts or listings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users_pabx' AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_id_status ON users_pabx (plan_id, status)';
  END IF;
END$$;

COMMIT;
