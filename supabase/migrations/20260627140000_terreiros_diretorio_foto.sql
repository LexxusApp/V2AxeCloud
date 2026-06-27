alter table public.terreiros_diretorio
  add column if not exists foto_url text;

comment on column public.terreiros_diretorio.foto_url is 'URL pública da foto principal (Google Maps), quando disponível';
