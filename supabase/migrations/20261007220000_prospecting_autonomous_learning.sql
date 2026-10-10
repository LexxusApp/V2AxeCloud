-- Migration: Prospecção IA - Auto-Aprendizado Autônomo e Memória Dinâmica
create table if not exists public.prospecting_learned_patterns (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  pattern_type text not null default 'effective_response',
  lead_question_pattern text not null,
  winning_response_example text not null,
  outcome_score integer not null default 10,
  times_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospecting_autonomous_guidelines (
  id uuid primary key default gen_random_uuid(),
  version integer not null default 1,
  is_active boolean not null default true,
  guidelines_text text not null,
  summary text,
  conversations_analyzed integer not null default 0,
  last_optimized_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.prospecting_learned_patterns enable row level security;
alter table public.prospecting_autonomous_guidelines enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'service_role_prospecting_learned_patterns') then
    create policy "service_role_prospecting_learned_patterns" on public.prospecting_learned_patterns for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'service_role_prospecting_autonomous_guidelines') then
    create policy "service_role_prospecting_autonomous_guidelines" on public.prospecting_autonomous_guidelines for all to service_role using (true) with check (true);
  end if;
end $$;

insert into public.prospecting_autonomous_guidelines (version, is_active, guidelines_text, summary, conversations_analyzed)
values (
  1,
  true,
  '1. Converse de forma leve e acolhedora, como alguém da equipe do AxéCloud que entende a rotina de terreiro.
2. NUNCA envie blocos gigantes de texto nem listas numeradas/com marcadores. Seja direto e caloroso em 1 ou 2 parágrafos curtos.
3. Não force o uso da palavra "Axé" em toda frase nem comece com saudações engessadas.
4. Quando perguntarem sobre funções (como mensalidades, camarinha ou presença), explique como resolve a vida do terreiro na prática antes de qualquer menção a teste.
5. Se o terreiro demonstrar interesse, ofereça os 30 dias de teste gratuito sem pedir cartão de crédito.',
  'Diretrizes iniciais calibradas para alta empatia e naturalidade',
  0
) on conflict do nothing;
