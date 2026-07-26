create table if not exists public.password_reset_whatsapp_otp (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0 check (attempts >= 0 and attempts <= 20),
  created_at timestamptz not null default now()
);

alter table public.password_reset_whatsapp_otp enable row level security;

revoke all on table public.password_reset_whatsapp_otp from anon, authenticated;
grant all on table public.password_reset_whatsapp_otp to service_role;

create index if not exists password_reset_whatsapp_otp_expires_at_idx
  on public.password_reset_whatsapp_otp (expires_at);

comment on table public.password_reset_whatsapp_otp is
  'Códigos OTP efêmeros de recuperação de senha enviados via WhatsApp; acesso exclusivo do service_role.';
