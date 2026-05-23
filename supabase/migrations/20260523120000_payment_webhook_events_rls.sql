-- Idempotência de webhooks EFI (payment_webhook_events).
-- Apenas o backend com SERVICE_ROLE_KEY escreve/lê — clientes anon/authenticated não têm policy.

alter table if exists public.payment_webhook_events enable row level security;

-- Sem policies para anon/authenticated: PostgREST nega acesso no app.
-- service_role bypassa RLS e mantém insert idempotente em api/lib/tenantOnboarding.ts.
