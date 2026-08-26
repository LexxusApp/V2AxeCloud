-- Semana 2: o perfil pode ser aprovado antes da criacao da conta.
-- A conexao posterior exige o protocolo aprovado e o mesmo e-mail da solicitacao.

create or replace function public.connect_approved_terreiro_claim(
  p_claim_id uuid,
  p_requester_email text,
  p_tenant_id uuid
)
returns public.terreiro_claim_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.terreiro_claim_requests;
begin
  select * into v_claim
  from public.terreiro_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'Solicitacao nao encontrada';
  end if;
  if v_claim.status <> 'approved' then
    raise exception 'Solicitacao ainda nao aprovada';
  end if;
  if lower(trim(v_claim.requester_email)) <> lower(trim(coalesce(p_requester_email, ''))) then
    raise exception 'E-mail diferente da solicitacao aprovada';
  end if;
  if v_claim.claimed_tenant_id is not null and v_claim.claimed_tenant_id <> p_tenant_id then
    raise exception 'Solicitacao ja vinculada a outra conta';
  end if;

  update public.terreiros_diretorio
  set claimed_by_tenant_id = p_tenant_id,
      verified_at = coalesce(verified_at, now())
  where id = v_claim.terreiro_id
    and (claimed_by_tenant_id is null or claimed_by_tenant_id = p_tenant_id);

  if not found then
    raise exception 'Perfil ja vinculado a outra conta';
  end if;

  update public.perfil_lider
  set casa_verificada = true,
      updated_at = now()
  where id = p_tenant_id;

  update public.terreiro_claim_requests
  set claimed_tenant_id = p_tenant_id,
      updated_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.connect_approved_terreiro_claim(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.connect_approved_terreiro_claim(uuid, text, uuid) to service_role;

comment on function public.connect_approved_terreiro_claim(uuid, text, uuid) is
  'Conecta uma reivindicacao aprovada a uma conta criada com o mesmo e-mail do solicitante.';
