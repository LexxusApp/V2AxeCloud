-- Índices para cotas anti-spam WhatsApp (consultas por data e telefone)

create index if not exists whatsapp_logs_sent_created_idx
  on public.whatsapp_logs (created_at desc)
  where status = 'sent';

create index if not exists whatsapp_logs_tenant_sent_created_idx
  on public.whatsapp_logs (tenant_id, created_at desc)
  where status = 'sent';

create index if not exists whatsapp_logs_phone_sent_created_idx
  on public.whatsapp_logs (telefone, created_at desc)
  where status = 'sent';

create index if not exists whatsapp_logs_tenant_tipo_created_idx
  on public.whatsapp_logs (tenant_id, tipo, created_at desc);

notify pgrst, 'reload schema';
