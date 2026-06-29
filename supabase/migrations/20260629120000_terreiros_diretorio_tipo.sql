alter table public.terreiros_diretorio
  add column if not exists tipo text not null default 'terreiro'
    check (tipo in ('terreiro', 'loja'));

create index if not exists terreiros_diretorio_tipo_idx
  on public.terreiros_diretorio (tipo);

comment on column public.terreiros_diretorio.tipo is 'terreiro = casa de axé; loja = artigos religiosos / comércio';
