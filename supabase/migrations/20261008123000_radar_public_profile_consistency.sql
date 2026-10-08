-- Mantém o Radar e a página pública como duas faces do mesmo perfil.

alter table public.terreiros_diretorio
  add column if not exists cover_photo_url text,
  add column if not exists gallery_photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists orientacoes_visita text;

alter table public.terreiros_diretorio
  drop constraint if exists terreiros_diretorio_gallery_photo_urls_array_check,
  add constraint terreiros_diretorio_gallery_photo_urls_array_check
    check (jsonb_typeof(gallery_photo_urls) = 'array' and jsonb_array_length(gallery_photo_urls) <= 8);

comment on column public.terreiros_diretorio.cover_photo_url is
  'Imagem horizontal usada como capa do perfil público.';
comment on column public.terreiros_diretorio.gallery_photo_urls is
  'Até oito imagens publicadas na galeria da casa.';
comment on column public.terreiros_diretorio.orientacoes_visita is
  'Orientações oficiais da casa para visitantes.';

create table if not exists public.terreiro_publicacoes (
  id uuid primary key default gen_random_uuid(),
  terreiro_id uuid not null references public.terreiros_diretorio(id) on delete cascade,
  titulo text not null,
  conteudo text not null,
  imagem_url text,
  status text not null default 'publicado',
  publicado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terreiro_publicacoes_status_check check (status in ('rascunho', 'publicado')),
  constraint terreiro_publicacoes_titulo_check check (char_length(titulo) between 3 and 140),
  constraint terreiro_publicacoes_conteudo_check check (char_length(conteudo) between 3 and 3000)
);

create index if not exists terreiro_publicacoes_publicas_idx
  on public.terreiro_publicacoes (terreiro_id, publicado_em desc)
  where status = 'publicado';

create or replace function public.set_updated_at_terreiro_publicacoes()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_terreiro_publicacoes_updated_at on public.terreiro_publicacoes;
create trigger trg_terreiro_publicacoes_updated_at
  before update on public.terreiro_publicacoes
  for each row execute function public.set_updated_at_terreiro_publicacoes();

alter table public.terreiro_publicacoes enable row level security;

drop policy if exists "terreiro_publicacoes_public_read" on public.terreiro_publicacoes;
create policy "terreiro_publicacoes_public_read"
  on public.terreiro_publicacoes for select to anon, authenticated
  using (status = 'publicado');

drop policy if exists "terreiro_publicacoes_owner_all" on public.terreiro_publicacoes;
create policy "terreiro_publicacoes_owner_all"
  on public.terreiro_publicacoes for all to authenticated
  using (
    terreiro_id in (
      select id from public.terreiros_diretorio
      where claimed_by_tenant_id = auth.uid()
    )
  )
  with check (
    terreiro_id in (
      select id from public.terreiros_diretorio
      where claimed_by_tenant_id = auth.uid()
    )
  );

revoke all on public.terreiro_publicacoes from anon;
grant select on public.terreiro_publicacoes to anon;
grant select, insert, update, delete on public.terreiro_publicacoes to authenticated;
grant all on public.terreiro_publicacoes to service_role;
revoke all on function public.set_updated_at_terreiro_publicacoes() from public, anon;
grant execute on function public.set_updated_at_terreiro_publicacoes() to service_role;

comment on table public.terreiro_publicacoes is
  'Publicações editoriais criadas pelo zelador no Radar e exibidas no perfil público da casa.';
