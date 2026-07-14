alter table public.terreiros_diretorio
  add column if not exists updated_at timestamptz;

update public.terreiros_diretorio
set updated_at = created_at
where updated_at is null;

alter table public.terreiros_diretorio
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public._terreiros_diretorio_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_terreiros_diretorio_set_updated_at
  on public.terreiros_diretorio;

create trigger trg_terreiros_diretorio_set_updated_at
before update on public.terreiros_diretorio
for each row execute function public._terreiros_diretorio_set_updated_at();

create index if not exists terreiros_diretorio_updated_at_idx
  on public.terreiros_diretorio (updated_at desc);
