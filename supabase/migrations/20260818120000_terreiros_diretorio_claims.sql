-- Reivindicacao de perfis do diretorio publico.
-- O envio e a analise passam sempre pela API (service role); nao ha acesso direto anonimo.

alter table public.terreiros_diretorio
  add column if not exists claimed_by_tenant_id uuid references public.perfil_lider(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists owner_photo_url text;

create index if not exists terreiros_diretorio_claimed_tenant_idx
  on public.terreiros_diretorio (claimed_by_tenant_id)
  where claimed_by_tenant_id is not null;

create table if not exists public.terreiro_claim_requests (
  id uuid primary key default gen_random_uuid(),
  terreiro_id uuid not null references public.terreiros_diretorio(id) on delete cascade,
  requester_name text not null,
  requester_role text not null,
  requester_email text not null,
  requester_phone text not null,
  evidence text not null,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  claimed_tenant_id uuid references public.perfil_lider(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists terreiro_claim_requests_status_created_idx
  on public.terreiro_claim_requests (status, created_at desc);

create index if not exists terreiro_claim_requests_terreiro_idx
  on public.terreiro_claim_requests (terreiro_id, created_at desc);

create unique index if not exists terreiro_claim_requests_one_approved_idx
  on public.terreiro_claim_requests (terreiro_id)
  where status = 'approved';

alter table public.terreiro_claim_requests enable row level security;

comment on table public.terreiro_claim_requests is
  'Solicitacoes de responsaveis para reivindicar perfis do diretorio publico.';
comment on column public.terreiro_claim_requests.evidence is
  'Link ou descricao da evidencia publica que comprova o vinculo com a casa.';

create or replace function public.review_terreiro_claim(
  p_claim_id uuid,
  p_status text,
  p_admin_notes text default null,
  p_tenant_id uuid default null,
  p_reviewed_by uuid default null
)
returns public.terreiro_claim_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.terreiro_claim_requests;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Status de revisao invalido';
  end if;

  select * into v_claim
  from public.terreiro_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'Solicitacao nao encontrada';
  end if;

  if p_status = 'approved' then
    update public.terreiro_claim_requests
    set status = 'rejected',
        admin_notes = coalesce(admin_notes, 'Substituida por outra solicitacao aprovada.'),
        reviewed_at = now(),
        reviewed_by = p_reviewed_by,
        updated_at = now()
    where terreiro_id = v_claim.terreiro_id
      and status = 'approved'
      and id <> p_claim_id;

    update public.terreiros_diretorio
    set claimed_by_tenant_id = p_tenant_id,
        verified_at = now()
    where id = v_claim.terreiro_id;

    if p_tenant_id is not null then
      update public.perfil_lider
      set casa_verificada = true,
          updated_at = now()
      where id = p_tenant_id;
    end if;
  end if;

  update public.terreiro_claim_requests
  set status = p_status,
      admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
      claimed_tenant_id = case when p_status = 'approved' then p_tenant_id else null end,
      reviewed_by = p_reviewed_by,
      reviewed_at = now(),
      updated_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.review_terreiro_claim(uuid, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.review_terreiro_claim(uuid, text, text, uuid, uuid) to service_role;
