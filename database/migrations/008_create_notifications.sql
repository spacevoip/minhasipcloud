-- =====================================================
-- MIGRAÇÃO: SISTEMA DE NOTIFICAÇÕES
-- =====================================================

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status_enum') THEN
    CREATE TYPE notification_status_enum AS ENUM ('draft', 'scheduled', 'active', 'expired', 'canceled', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_audience_enum') THEN
    -- all: todos os usuários e revendas
    -- users: somente usuários (role=user)
    -- resellers: somente revendas (role=reseller)
    -- reseller_users: usuários de uma revenda específica (exige target_reseller_id)
    CREATE TYPE notification_audience_enum AS ENUM ('all', 'users', 'resellers', 'reseller_users');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipient_status_enum') THEN
    CREATE TYPE recipient_status_enum AS ENUM ('pending', 'delivered', 'read', 'dismissed');
  END IF;
END$$;

-- 2) Tabela principal de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by           UUID NOT NULL REFERENCES users_pabx(id) ON DELETE CASCADE,

  title                VARCHAR(150),
  message              TEXT NOT NULL,
  status               notification_status_enum NOT NULL DEFAULT 'active',

  audience_type        notification_audience_enum NOT NULL,
  target_reseller_id   UUID REFERENCES users_pabx(id),

  expires_at           TIMESTAMP,

  created_at           TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
  updated_at           TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),

  CONSTRAINT notifications_target_reseller_required
    CHECK (
      (audience_type = 'reseller_users' AND target_reseller_id IS NOT NULL)
      OR (audience_type <> 'reseller_users' AND target_reseller_id IS NULL)
    )
);

-- Trigger para manter updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_notifications_updated_at'
  ) THEN
    CREATE TRIGGER update_notifications_updated_at
      BEFORE UPDATE ON notifications
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience_type);
CREATE INDEX IF NOT EXISTS idx_notifications_target_reseller ON notifications(target_reseller_id);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- 3) Tabela de destinatários
CREATE TABLE IF NOT EXISTS notification_recipients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id      UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users_pabx(id) ON DELETE CASCADE,

  status               recipient_status_enum NOT NULL DEFAULT 'pending',
  delivered_at         TIMESTAMP,
  read_at              TIMESTAMP,
  dismissed_at         TIMESTAMP,

  created_at           TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
  updated_at           TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),

  CONSTRAINT uq_notification_recipient UNIQUE (notification_id, user_id)
);

-- Trigger para manter updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_recipients_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_recipients_updated_at
      BEFORE UPDATE ON notification_recipients
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification ON notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_status ON notification_recipients(status);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_read_at ON notification_recipients(read_at);

-- View opcional: notificações ativas
CREATE OR REPLACE VIEW v_active_notifications AS
SELECT
  n.id,
  n.title,
  n.message,
  n.status,
  n.audience_type,
  n.target_reseller_id,
  n.expires_at,
  n.created_by,
  n.created_at,
  n.updated_at
FROM notifications n
WHERE n.status = 'active'
  AND (n.expires_at IS NULL OR n.expires_at > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'));
