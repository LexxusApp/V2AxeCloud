-- Mantém o motivo do bloqueio para separar vencimento automático de bloqueio manual.
alter table public.perfil_lider
  add column if not exists access_block_reason text;

alter table public.perfil_lider
  add column if not exists access_blocked_at timestamptz;

create index if not exists perfil_lider_subscription_expired_block_idx
  on public.perfil_lider (access_blocked_at desc)
  where access_block_reason = 'subscription_expired';