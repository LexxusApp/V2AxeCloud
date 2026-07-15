-- Auditoria e idempotência da confirmação automática de mensalidades por comprovante.
create table if not exists public.financeiro_comprovantes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  financeiro_id uuid not null references public.financeiro(id) on delete cascade,
  filho_id uuid not null references public.filhos_de_santo(id) on delete cascade,
  arquivo_sha256 text not null,
  id_transacao_norm text not null,
  valor numeric(12,2) not null check (valor > 0),
  data_pagamento date not null,
  beneficiario_lido text not null,
  status text not null default 'processando' check (status in ('processando', 'aceito')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists financeiro_comprovantes_arquivo_sha256_uidx
  on public.financeiro_comprovantes (arquivo_sha256);

create unique index if not exists financeiro_comprovantes_id_transacao_uidx
  on public.financeiro_comprovantes (id_transacao_norm);

create index if not exists financeiro_comprovantes_tenant_created_idx
  on public.financeiro_comprovantes (tenant_id, created_at desc);

alter table public.financeiro_comprovantes enable row level security;

comment on table public.financeiro_comprovantes is
  'Registro interno antifraude dos comprovantes usados para liquidar mensalidades; acesso somente via service role.';
