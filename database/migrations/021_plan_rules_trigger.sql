-- Garantir dependências: função de cálculo já definida em 003_add_plan_activation_fields.sql
-- CREATE OR REPLACE FUNCTION calculate_plan_expiration(activation_date TIMESTAMP, period_days INTEGER) RETURNS TIMESTAMP ...

-- Função do trigger
CREATE OR REPLACE FUNCTION apply_plan_rules_trigger()
RETURNS TRIGGER AS $fn$
DECLARE
  days INTEGER;
BEGIN
  -- Aplica regras quando:
  -- 1) INSERT com plan_id
  -- 2) UPDATE alterando plan_id
  -- 3) UPDATE mantendo plan_id mas alterando plan_activated_at (renovação)

  IF (TG_OP = 'INSERT' AND NEW.plan_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND (NEW.plan_id IS DISTINCT FROM OLD.plan_id))
     OR (TG_OP = 'UPDATE' AND NEW.plan_id IS NOT NULL AND (NEW.plan_activated_at IS DISTINCT FROM OLD.plan_activated_at))
  THEN
    -- Buscar period_days do plano selecionado
    SELECT period_days INTO days FROM planos_pabx WHERE id = NEW.plan_id;

    -- Se não encontrar, não altera datas
    IF days IS NULL THEN
      RETURN NEW;
    END IF;

    -- Definir data de ativação (se não fornecida)
    IF NEW.plan_activated_at IS NULL THEN
      NEW.plan_activated_at := CURRENT_TIMESTAMP;
    END IF;

    -- Calcular expiração
    NEW.plan_expires_at := calculate_plan_expiration(NEW.plan_activated_at, days);

    -- Sinalizar ativo (status boolean final pode ser ajustado por outro trigger existente)
    NEW.plan_status := TRUE;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- Criar trigger que aplica as regras antes de inserir/atualizar
DROP TRIGGER IF EXISTS trigger_apply_plan_rules ON users_pabx;
CREATE TRIGGER trigger_apply_plan_rules
  BEFORE INSERT OR UPDATE OF plan_id, plan_activated_at ON users_pabx
  FOR EACH ROW
  EXECUTE FUNCTION apply_plan_rules_trigger();

-- Observação:
-- Mantemos o trigger existente `trigger_update_plan_status_boolean` (de 006_fix_plan_status_...)
-- que ajusta o plan_status com base em plan_expires_at. Este trigger aqui cuida das datas.

-- Testes sugeridos:
-- 1) Vincular plano: UPDATE users_pabx SET plan_id = '<plano-uuid>' WHERE id = '<user>';
--    -> plan_activated_at = now(), plan_expires_at = now() + period_days
-- 2) Renovar plano atual: UPDATE users_pabx SET plan_activated_at = now() WHERE id = '<user>';
--    -> plan_expires_at recalculado com base no mesmo plan_id
-- 3) Trocar plano X->Y: UPDATE users_pabx SET plan_id = '<planoY>' WHERE id = '<user>';
--    -> datas recalculadas usando period_days de Y
