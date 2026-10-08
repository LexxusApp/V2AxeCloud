-- Radar: mídia e informações editoriais do perfil público da casa.
alter table public.terreiros_diretorio
  add column if not exists cover_photo_url text,
  add column if not exists gallery_photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists orientacoes_visita text,
  add column if not exists tradicao text;
alter table public.terreiros_diretorio
  drop constraint if exists terreiros_diretorio_gallery_photo_urls_array,
  add constraint terreiros_diretorio_gallery_photo_urls_array check (jsonb_typeof(gallery_photo_urls) = 'array' and jsonb_array_length(gallery_photo_urls) <= 8),
  drop constraint if exists terreiros_diretorio_tradicao_check,
  add constraint terreiros_diretorio_tradicao_check check (tradicao is null or tradicao in ('umbanda', 'candomble', 'jurema', 'mista', 'outra'));
comment on column public.terreiros_diretorio.cover_photo_url is 'Imagem de capa escolhida pelo zelador para o perfil público no diretório.';
comment on column public.terreiros_diretorio.gallery_photo_urls is 'Galeria pública curada no Radar, limitada a oito imagens.';
comment on column public.terreiros_diretorio.orientacoes_visita is 'Orientações públicas de roupa, chegada e convivência para visitantes.';
comment on column public.terreiros_diretorio.tradicao is 'Tradição exibida no perfil público da casa.';
