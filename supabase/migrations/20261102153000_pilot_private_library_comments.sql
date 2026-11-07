begin;
create table if not exists public.piloto_biblioteca_comentarios(
 id uuid primary key,material_id uuid not null references public.piloto_biblioteca_privada(id) on delete cascade,
 author_id uuid not null,author_name text not null,leadership boolean not null,
 texto text not null check(length(btrim(texto)) between 1 and 2000),created_at timestamptz not null default now()
);
alter table public.piloto_biblioteca_comentarios enable row level security;
revoke all on public.piloto_biblioteca_comentarios from public,anon,authenticated;
grant select on public.piloto_biblioteca_comentarios to authenticated;
drop policy if exists pilot_private_comments_read on public.piloto_biblioteca_comentarios;
create policy pilot_private_comments_read on public.piloto_biblioteca_comentarios for select to authenticated using(public.piloto_pode_ler_pdf(material_id));
create or replace function public.piloto_comentar_pdf(p_material uuid,p_request uuid,p_text text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();material public.piloto_biblioteca_privada;prior public.piloto_biblioteca_comentarios;author text;leader boolean;
begin
 if actor is null or not public.piloto_pode_ler_pdf(p_material) then raise exception 'Você não tem acesso a este estudo' using errcode='42501';end if;
 if p_request is null or p_text is null or length(btrim(p_text)) not between 1 and 2000 then raise exception 'Escreva um comentário de até 2.000 caracteres' using errcode='22023';end if;
 select * into material from public.piloto_biblioteca_privada where id=p_material for key share;
 if not found then raise exception 'O material foi removido' using errcode='23505';end if;
 perform pg_advisory_xact_lock(hashtextextended('pilot-pdf-comment:'||p_request::text,0));
 select * into prior from public.piloto_biblioteca_comentarios where id=p_request;
 if found then
  if prior.material_id<>p_material or prior.author_id<>actor or prior.texto<>btrim(p_text) then raise exception 'Esta tentativa já foi usada com outro comentário' using errcode='23505';end if;
  return jsonb_build_object('id',prior.id,'replayed',true);
 end if;
 leader:=actor=material.tenant_id;
 if leader then select coalesce(nullif(zelador,''),'Zeladoria') into author from public.perfil_lider where id=actor;
 else select nome into author from public.filhos_de_santo where id=material.destinatario;end if;
 insert into public.piloto_biblioteca_comentarios(id,material_id,author_id,author_name,leadership,texto)
 values(p_request,p_material,actor,coalesce(nullif(author,''),'Membro'),leader,btrim(p_text));
 return jsonb_build_object('id',p_request,'replayed',false);
end $$;
revoke all on function public.piloto_comentar_pdf(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.piloto_comentar_pdf(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
