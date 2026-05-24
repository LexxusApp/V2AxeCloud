-- Remove policies RLS legadas (USING true / duplicatas) que anulam as policies
-- restritivas de 20260521120000, 20260522120000 e 20260523140000.
-- PostgreSQL combina policies com OR — uma policy permissiva abre tudo.

-- ── Policies abertas (USING true) ──────────────────────────────────────────

drop policy if exists "filhos_de_santo_authenticated_rw" on public.filhos_de_santo;
drop policy if exists "global_settings_authenticated_rw" on public.global_settings;
drop policy if exists "logs_auditoria_authenticated_rw" on public.logs_auditoria;
drop policy if exists "perfil_lider_authenticated_rw" on public.perfil_lider;
drop policy if exists "subscriptions_authenticated_rw" on public.subscriptions;
drop policy if exists "system_announcements_authenticated_rw" on public.system_announcements;
drop policy if exists "Allow all for service role" on public.whatsapp_sessions;

drop policy if exists "Permitir inserção de produtos" on public.produtos;
drop policy if exists "Permitir leitura de produtos" on public.produtos;

-- ── Duplicatas substituídas por harden_core / harden_guests / harden_billing ─

-- almoxarifado
drop policy if exists "Tenant access for inventory" on public.almoxarifado;
drop policy if exists "Users can manage their own inventory" on public.almoxarifado;

-- biblioteca
drop policy if exists "Biblioteca_Insert" on public.biblioteca;
drop policy if exists "Biblioteca_Modify" on public.biblioteca;
drop policy if exists "Biblioteca_Select" on public.biblioteca;

-- calendario_axe
drop policy if exists "Tenant access for calendar" on public.calendario_axe;
drop policy if exists "Users can manage their own calendar" on public.calendario_axe;

-- configuracoes_pix (legado snake_case — substituído por pix tenant / pix zelador)
drop policy if exists "configuracoes_pix_select" on public.configuracoes_pix;
drop policy if exists "configuracoes_pix_insert" on public.configuracoes_pix;
drop policy if exists "configuracoes_pix_update" on public.configuracoes_pix;
drop policy if exists "configuracoes_pix_delete" on public.configuracoes_pix;

-- convidados_eventos
drop policy if exists "Users can manage guests for their events" on public.convidados_eventos;

-- filhos_de_santo
drop policy if exists "Tenant access for children" on public.filhos_de_santo;
drop policy if exists "Users can manage their own children" on public.filhos_de_santo;

-- financeiro
drop policy if exists "Tenant access for finances" on public.financeiro;
drop policy if exists "Users can manage their own finances" on public.financeiro;

-- mural_avisos
drop policy if exists "Users can manage their own notices" on public.mural_avisos;

-- notificacoes
drop policy if exists "Users can manage their own notifications" on public.notificacoes;

-- perfil_lider (legado — substituído por perfil self read/write)
drop policy if exists "Global Admins full access" on public.perfil_lider;
drop policy if exists "Users can view own profile" on public.perfil_lider;
drop policy if exists "Users update own profile" on public.perfil_lider;
drop policy if exists "Users view relevant profiles" on public.perfil_lider;

-- produtos (legado — substituído por produtos tenant access)
drop policy if exists "Isolamento por Terreiro - Produtos All" on public.produtos;
drop policy if exists "Isolamento por Terreiro - Produtos Select" on public.produtos;

-- push_subscriptions (legado granular — substituído por push own rows)
drop policy if exists "push_subs_delete_own" on public.push_subscriptions;
drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
drop policy if exists "push_subs_select_own" on public.push_subscriptions;
drop policy if exists "push_subs_update_own" on public.push_subscriptions;

-- subscriptions (legado — substituído por subscriptions tenant read)
drop policy if exists "Global Admins have full access to subscriptions" on public.subscriptions;
drop policy if exists "Subscription access" on public.subscriptions;
drop policy if exists "Users can view own subscription" on public.subscriptions;
drop policy if exists "Users can view their own subscription" on public.subscriptions;

notify pgrst, 'reload schema';
