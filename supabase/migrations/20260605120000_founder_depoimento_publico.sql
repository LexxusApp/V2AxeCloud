-- Depoimentos autorizados para exibição pública na landing

alter table public.founder_applications
  add column if not exists depoimento_texto text,
  add column if not exists depoimento_publicado boolean not null default false;

create index if not exists idx_founder_applications_depoimento_publico
  on public.founder_applications (depoimento_publicado)
  where depoimento_publicado = true and depoimento_texto is not null;
