alter table public.terreiros_diretorio
  add column if not exists instagram_url text;

comment on column public.terreiros_diretorio.instagram_url is
  'Perfil oficial do terreiro no Instagram, informado pelo responsável verificado.';
