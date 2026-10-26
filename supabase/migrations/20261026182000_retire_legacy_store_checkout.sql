-- Impede que versões antigas contornem o checkout transacional e a idempotência.
revoke all on function public.processar_checkout(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
