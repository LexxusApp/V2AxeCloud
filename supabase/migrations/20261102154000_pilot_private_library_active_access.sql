begin;
-- Match the active-member check already enforced by the member pilot gate.
-- Applies only to the separate private pilot acervo.
create or replace function public.piloto_pode_ler_pdf(p_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.piloto_biblioteca_privada b where b.id=p_id and
  (auth.uid()=b.tenant_id or exists(select 1 from public.filhos_de_santo f join auth.users u on u.id=auth.uid()
    where f.id=b.destinatario and (f.tenant_id=b.tenant_id or f.lider_id=b.tenant_id)
      and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
      and (f.user_id=u.id or lower(f.email)=lower(u.email) or lower(u.email) in ('f_'||f.id::text||'@axecloud.internal','filho_'||f.id::text||'@axecloud.com')))));
$$;
revoke all on function public.piloto_pode_ler_pdf(uuid) from public,anon;
grant execute on function public.piloto_pode_ler_pdf(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
