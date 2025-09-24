-- =====================================================
-- 012_adjust_notifications_title_and_type.sql
-- Objetivo:
-- 1) Garantir a coluna 'title' (exibida como "Mensagem" no UI) em notifications
-- 2) Garantir a coluna 'type' e popular a partir de audience_type
-- 3) Índices úteis
-- =====================================================

BEGIN;

-- 1) Adicionar coluna 'title' se não existir
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title VARCHAR(150);

-- 2) Adicionar coluna 'type' (texto curto) se não existir
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- 2.1) Popular 'type' a partir de 'audience_type' quando possível
-- Observação: em alguns schemas 'audience_type' é ENUM; usamos ::text para converter
UPDATE notifications
   SET type = COALESCE(type, CASE WHEN audience_type IS NOT NULL THEN audience_type::text ELSE NULL END)
 WHERE type IS NULL;

-- 3) Índices (idempotentes)
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_title ON notifications(title);

COMMIT;
