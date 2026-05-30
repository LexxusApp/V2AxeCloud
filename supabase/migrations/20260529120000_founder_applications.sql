-- Inscrições do Programa Fundador AxéCloud (portal / programa-fundador)

create table if not exists public.founder_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome_casa text not null,
  cidade text not null,
  estado text not null,
  tradicao text not null,
  whatsapp text not null,
  nome_contato text,
  email text,
  mensagem text,
  autoriza_perfil_publico boolean not null default false,
  autoriza_depoimento boolean not null default false,
  status text not null default 'pending',
  ip text,
  user_agent text
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'founder_applications_status_check'
      and conrelid = 'public.founder_applications'::regclass
  ) then
    alter table public.founder_applications
      add constraint founder_applications_status_check
      check (status in ('pending', 'contacted', 'accepted', 'rejected'));
  end if;
exception
  when others then
    raise notice 'founder_applications_status_check: %', sqlerrm;
end $$;

create index if not exists idx_founder_applications_created_at
  on public.founder_applications (created_at desc);

create index if not exists idx_founder_applications_whatsapp
  on public.founder_applications (whatsapp);

create index if not exists idx_founder_applications_status
  on public.founder_applications (status);

alter table public.founder_applications enable row level security;
