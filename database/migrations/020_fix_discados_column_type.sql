-- Migração para corrigir o tipo da coluna discados de VARCHAR para INTEGER
-- Data: 2025-08-24
-- Descrição: A coluna discados estava como VARCHAR causando concatenação ao invés de soma

-- Primeiro, vamos verificar se existem dados na coluna e convertê-los
UPDATE mailings_pabx 
SET discados = CASE 
  WHEN discados IS NULL OR discados = '' THEN '0'
  WHEN discados ~ '^[0-9]+$' THEN discados
  ELSE '0'
END;

-- Alterar o tipo da coluna para INTEGER
ALTER TABLE mailings_pabx 
ALTER COLUMN discados TYPE INTEGER USING COALESCE(discados::INTEGER, 0);

-- Definir valor padrão como 0
ALTER TABLE mailings_pabx 
ALTER COLUMN discados SET DEFAULT 0;

-- Adicionar constraint para garantir que não seja negativo
ALTER TABLE mailings_pabx 
ADD CONSTRAINT discados_non_negative CHECK (discados >= 0);

-- Comentário na coluna
COMMENT ON COLUMN mailings_pabx.discados IS 'Contador de discagens realizadas para esta campanha (INTEGER)';
