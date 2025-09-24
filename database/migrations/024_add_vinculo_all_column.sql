-- Adicionar coluna vinculo_all para armazenar IDs dos ramais selecionados
-- para campanhas com múltiplos agentes (separados por vírgula)

ALTER TABLE mailings_pabx 
ADD COLUMN vinculo_all TEXT;

-- Comentário explicativo
COMMENT ON COLUMN mailings_pabx.vinculo_all IS 'IDs dos ramais selecionados para campanhas com múltiplos agentes, separados por vírgula';
