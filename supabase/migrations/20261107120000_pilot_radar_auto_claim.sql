-- Permite que qualquer zelador ou coadministrador autorizado salve o perfil no Radar
-- sem necessidade de reivindicação manual prévia de cadastro externo.
-- Se o terreiro ainda não tiver registro em terreiros_diretorio, cria-se automaticamente o vínculo.

create or replace function public.piloto_radar_salvar(p_tenant uuid,p_profile jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare old public.piloto_radar_perfis;next_revision bigint;
begin
 perform public.piloto_radar_autorizar(p_tenant);perform public.piloto_radar_validar(p_profile);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':radar',0));
 if not exists(select 1 from public.terreiros_diretorio where claimed_by_tenant_id=p_tenant and slug is not null) then
   insert into public.terreiros_diretorio(nome, cidade, estado, tipo, claimed_by_tenant_id, slug, publicacao_status)
   select coalesce(nullif(p_profile->>'publicName',''), perfil.nome_terreiro, 'Terreiro'),
          coalesce(nullif(p_profile->>'city',''), perfil.cidade_publica, 'São Paulo'),
          coalesce(nullif(p_profile->>'uf',''), perfil.estado_publico, 'SP'),
          'terreiro',
          p_tenant,
          coalesce(nullif(perfil.public_slug,''), 'terreiro-' || substr(replace(p_tenant::text, '-', ''), 1, 8)),
          case when (p_profile->>'published')::boolean then 'publicado' else 'rascunho' end
   from public.perfil_lider perfil
   where perfil.id = p_tenant
   on conflict do nothing;
 end if;
 select * into old from public.piloto_radar_perfis where tenant_id=p_tenant for update;
 if old.profile=p_profile then return jsonb_build_object('profile',old.profile,'revision',old.revision);end if;
 if p_revision is null or p_revision<>coalesce(old.revision,0) then raise exception 'O perfil mudou. Atualize antes de salvar.' using errcode='23505';end if;
 next_revision:=coalesce(old.revision,0)+1;
 insert into public.piloto_radar_perfis(tenant_id,profile,revision) values(p_tenant,p_profile,next_revision)
 on conflict(tenant_id) do update set profile=excluded.profile,revision=excluded.revision,updated_at=now();
 update public.terreiros_diretorio set updated_at=now() where claimed_by_tenant_id=p_tenant;
 update public.perfil_lider set bairro_publico=case when (p_profile->>'showAddress')::boolean and (p_profile->>'published')::boolean then p_profile->>'neighborhood' else null end where id=p_tenant;
 return jsonb_build_object('profile',p_profile,'revision',next_revision);
end $$;
