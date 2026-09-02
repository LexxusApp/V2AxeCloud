-- Radar: transforma os dados do diretório em uma vitrine controlada pelo zelador.

alter table public.terreiros_diretorio
  alter column link_maps drop not null,
  add column if not exists descricao_publica text,
  add column if not exists publicacao_status text not null default 'publicado',
  add column if not exists publicado_em timestamptz;
alter table public.terreiros_diretorio
  drop constraint if exists terreiros_diretorio_publicacao_status_check,
  add constraint terreiros_diretorio_publicacao_status_check
    check (publicacao_status in ('rascunho', 'publicado', 'oculto'));
create index if not exists terreiros_diretorio_publicacao_status_idx
  on public.terreiros_diretorio (publicacao_status)
  where publicacao_status = 'publicado';
comment on column public.terreiros_diretorio.descricao_publica is
  'Biografia pública da casa, editada pelo zelador no módulo Radar.';
comment on column public.terreiros_diretorio.publicacao_status is
  'Controle de visibilidade do perfil no mapa: rascunho, publicado ou oculto.';
