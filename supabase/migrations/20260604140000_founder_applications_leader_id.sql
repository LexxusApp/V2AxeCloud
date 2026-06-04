-- Vincula inscrição do Programa Fundador ao terreiro já existente (perfil_lider / auth id).

alter table public.founder_applications
  add column if not exists leader_id uuid;

comment on column public.founder_applications.leader_id is
  'ID do zelador (perfil_lider.id = auth.users.id) quando a casa já está cadastrada no AxéCloud.';

create index if not exists idx_founder_applications_leader_id
  on public.founder_applications (leader_id)
  where leader_id is not null;

create unique index if not exists idx_founder_applications_leader_active
  on public.founder_applications (leader_id)
  where leader_id is not null
    and status in ('pending', 'contacted', 'accepted');

-- Casa fundadora já cadastrada (Kwe Nago / terreiro1@axecloud.com)
update public.founder_applications
set leader_id = 'a90db681-e55f-4668-8715-34e23ffbb591'::uuid
where lower(trim(coalesce(email, ''))) = 'terreiro1@axecloud.com'
  and leader_id is null;
