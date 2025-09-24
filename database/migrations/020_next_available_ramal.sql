-- =====================================================
-- Migration: Function next_available_ramal
-- Purpose: Provide an atomic, fast way to get the next available 4-digit ramal
-- Notes:
--   - Ramal is globally unique (UNIQUE on agentes_pabx.ramal)
--   - Function returns the smallest available 4-digit ramal as TEXT (preserves leading zeros if range allows)
--   - Defaults to range 1000..9999 but can be parameterized
-- =====================================================

CREATE OR REPLACE FUNCTION next_available_ramal(p_start INTEGER DEFAULT 1000, p_end INTEGER DEFAULT 9999)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
WITH series AS (
  SELECT to_char(n, 'FM0000') AS ramal
  FROM generate_series(p_start, p_end) AS gs(n)
),
occupied AS (
  SELECT ramal FROM agentes_pabx
),
available AS (
  SELECT s.ramal
  FROM series s
  LEFT JOIN occupied o ON o.ramal = s.ramal
  WHERE o.ramal IS NULL
  ORDER BY s.ramal ASC
  LIMIT 1
)
SELECT ramal FROM available;
$$;

-- Ensure function runs with owner privileges and proper schema resolution
ALTER FUNCTION next_available_ramal(INTEGER, INTEGER) SECURITY DEFINER;
ALTER FUNCTION next_available_ramal(INTEGER, INTEGER) SET search_path = public;

-- Optional: Comment for documentation
COMMENT ON FUNCTION next_available_ramal(INTEGER, INTEGER) IS 'Returns the smallest available ramal (TEXT) in the given inclusive range [p_start, p_end]';

-- Allow Supabase roles to call the function via RPC
GRANT EXECUTE ON FUNCTION next_available_ramal(INTEGER, INTEGER) TO anon, authenticated;
