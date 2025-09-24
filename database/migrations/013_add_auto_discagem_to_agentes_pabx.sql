-- 013_add_auto_discagem_to_agentes_pabx.sql
-- Adiciona a coluna auto_discagem à tabela agentes_pabx

BEGIN;

ALTER TABLE IF EXISTS agentes_pabx
  ADD COLUMN IF NOT EXISTS auto_discagem BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN agentes_pabx.auto_discagem IS 'Habilita auto discagem para o ramal';

COMMIT;
