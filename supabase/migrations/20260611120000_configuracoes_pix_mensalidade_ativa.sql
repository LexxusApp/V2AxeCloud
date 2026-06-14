-- Permite ao zelador desativar cobrança de mensalidade no terreiro (sem apagar histórico).
ALTER TABLE public.configuracoes_pix
  ADD COLUMN IF NOT EXISTS mensalidade_ativa boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.configuracoes_pix.mensalidade_ativa IS
  'Quando false, o sistema não gera mensalidades pendentes nem exibe cobrança aos filhos de santo.';
