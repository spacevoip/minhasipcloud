-- =============================================================
-- Create notifications tables (PostgreSQL)
-- - Enums: notification_status_enum, audience_type_enum, recipient_status_enum
-- - Tables: notifications, notification_recipients
-- - Indexes: status, audience_type, target_reseller_id, created_at, expires_at, recipients FKs
-- - No triggers/audit
-- =============================================================

-- 0) UUID extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status_enum') THEN
    CREATE TYPE notification_status_enum AS ENUM ('draft', 'active', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audience_type_enum') THEN
    CREATE TYPE audience_type_enum AS ENUM ('all', 'users', 'resellers', 'reseller_users');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipient_status_enum') THEN
    CREATE TYPE recipient_status_enum AS ENUM ('pending', 'delivered', 'read', 'dismissed');
  END IF;
END$$;

-- 2) notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status notification_status_enum NOT NULL DEFAULT 'draft',
  audience_type audience_type_enum NOT NULL,
  target_reseller_id UUID NULL,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional FK to users_pabx(id). Comment out if not wanted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='notifications' AND constraint_name='notifications_target_reseller_id_fkey'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_target_reseller_id_fkey
      FOREIGN KEY (target_reseller_id) REFERENCES users_pabx(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 3) Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_audience_type ON notifications(audience_type);
CREATE INDEX IF NOT EXISTS idx_notifications_target_reseller_id ON notifications(target_reseller_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);

-- 4) notification_recipients
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users_pabx(id) ON DELETE CASCADE,
  status recipient_status_enum NOT NULL DEFAULT 'pending',
  delivered_at TIMESTAMPTZ NULL,
  read_at TIMESTAMPTZ NULL,
  dismissed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_notification_recipient UNIQUE (notification_id, user_id)
);

-- 4.1) Indexes for notification_recipients
CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id ON notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_id ON notification_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_status ON notification_recipients(status);
