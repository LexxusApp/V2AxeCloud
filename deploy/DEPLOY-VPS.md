# Deploy AxéCloud na VPS (Contabo)

Servidor de referência: `66.94.103.197`, pasta `/opt/axecloud`.

## 1. DNS (Cloudflare)

| Tipo | Nome | Conteúdo | Proxy |
|------|------|----------|-------|
| A | `@` | IP da VPS | Ligado (recomendado) |
| A | `www` | IP da VPS | Ligado |

Painel admin (`axecloud-admin`) pode continuar na Vercel apontando API para `https://axecloud.com.br`.

## 2. Código no servidor

```bash
cd /opt/axecloud
apt install -y git
git clone https://github.com/SEU_USUARIO/AxecloudV2.git .
# ou: rsync/scp do PC para /opt/axecloud
cp deploy/.env.vps.example .env
nano .env   # preencher secrets (copiar do Vercel/.env local)
```

## 3. Subir stack

O deploy sobe **dois frontends** no mesmo domínio:

| Serviço | Rotas | Função |
|---------|-------|--------|
| `marketing` | `/`, `/termos`, `/privacidade`, `/programa-fundador`, `/espaco-do-fiel`, `/conteudo/*` | Site leve (nginx + `landing-dist`) |
| `app` | `/login`, `/register`, `/dashboard`, `/api/*`, etc. | SPA + API Node |

```bash
cd /opt/axecloud
docker compose -f deploy/docker-compose.yml --env-file .env build
docker compose -f deploy/docker-compose.yml --env-file .env up -d
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f app
docker compose -f deploy/docker-compose.yml logs -f marketing
```

Teste: `curl -sS http://127.0.0.1:3000/api/plans` (via rede interna do host pode precisar `docker exec`).

## 4. Cron (ping Evolution + WhatsApp)

No host (scripts em `deploy/cron-ping-evolution.sh` e `deploy/cron-whatsapp-jobs.sh`):

```bash
chmod +x /opt/axecloud/deploy/cron-ping-evolution.sh
chmod +x /opt/axecloud/deploy/cron-whatsapp-jobs.sh
sed -i 's/\r$//' /opt/axecloud/deploy/cron-ping-evolution.sh   # se veio do Windows
sed -i 's/\r$//' /opt/axecloud/deploy/cron-whatsapp-jobs.sh
(crontab -l 2>/dev/null | grep -v cron-ping-evolution; echo "*/10 * * * * /opt/axecloud/deploy/cron-ping-evolution.sh") | crontab -
(crontab -l 2>/dev/null | grep -v cron-whatsapp-jobs; echo "0 9 * * * /opt/axecloud/deploy/cron-whatsapp-jobs.sh") | crontab -
```

O script usa a rede Docker (`http://app:3000/...`) para não seguir redirect HTTPS do Caddy para a Vercel enquanto o DNS ainda aponta para `76.76.21.21`.

`cron-whatsapp-jobs.sh` dispara lembretes de mensalidade (3 dias antes e no vencimento) e alertas de estoque crítico — uma vez por dia às 09:00.

## 5. Webhooks

Atualizar URLs no painel Efí / integrações para `https://axecloud.com.br/...`.

`EVOLUTION_API_BASE_URL` no app = `http://evolution:8080` (rede Docker).

## 6. Cutover

1. Testar login, dashboard, WhatsApp, pagamento.
2. Desativar deploy Vercel (app) e Railway (Evolution) quando estável.
3. Manter Supabase remoto.

## 7. Atualizar versão

```bash
cd /opt/axecloud && git pull
docker compose -f deploy/docker-compose.yml --env-file .env build app
docker compose -f deploy/docker-compose.yml --env-file .env up -d app
```

## 8. Segurança (Semana 1)

### Na VPS (scripts em `deploy/scripts/`)

```bash
# Hardening SSH, fail2ban, Netdata, .env 600
bash deploy/scripts/vps-hardening.sh

# Headers HTTP (Caddyfile), swap 2G, healthcheck cron
bash deploy/scripts/vps-week1-security.sh

# Rotacionar CRON_SECRET + EVOLUTION_API_KEY (faz backup do .env)
bash deploy/scripts/rotate-vps-secrets.sh
```

Healthcheck: log em `/var/log/axecloud-healthcheck.log` (cron `*/5`).

### Cloudflare (painel — manual)

1. **SSL/TLS** → Full (strict), Minimum TLS 1.2, Always Use HTTPS.
2. **Security** → Bot Fight Mode: On (se não atrapalhar usuários legítimos).
3. **Security** → WAF → Managed rules: On.
4. **Security** → WAF → Custom rule** (exemplo):
   - Nome: `Rate limit API sensível`
   - Expression: `(http.request.uri.path contains "/api/whatsapp") or (http.request.uri.path contains "/api/auth")`
   - Action: Block ou Managed Challenge se > 60 req/min por IP.
5. **DNS** → Proxy laranja em `@` e `www` (já deve estar).
6. Conta Cloudflare: ativar **2FA** no login.

Uptime externo (opcional): [UptimeRobot](https://uptimerobot.com) monitorando `https://axecloud.com.br/api/plans` a cada 5 min.

## 9. Segurança (Semana 2)

### Na VPS

```bash
# Anti-scanner no Caddy, healthcheck pela URL pública (Cloudflare + TLS)
bash deploy/scripts/vps-week2-security.sh
```

Logs:

- Interno (Docker): `/var/log/axecloud-healthcheck.log`
- Externo (HTTPS): `/var/log/axecloud-external-healthcheck.log`

Teste anti-scanner (deve retornar 404):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://axecloud.com.br/.env
curl -sS -o /dev/null -w "%{http_code}\n" https://axecloud.com.br/wp-admin/
```

### Cloudflare (painel — espelhar o Caddy)

**Security → Security rules → Custom rule** (ação **Block**):

- Nome: `Block scanner paths`
- Expression:

```
(http.request.uri.path contains "/wp-admin") or
(http.request.uri.path contains "/.env") or
(http.request.uri.path contains "/phpmyadmin") or
(http.request.uri.path contains "/xmlrpc.php") or
(http.request.uri.path contains "/vendor/phpunit")
```

Não aplicar Challenge em `/api/*` — só Block nesses paths.

### Contas (manual, ~10 min)

- Cloudflare: **2FA** no login da conta
- Supabase: **2FA** no dashboard
- Contabo: **2FA** no painel

### Auditoria RLS (dev)

```bash
npx supabase db query --linked "SELECT relname, relrowsecurity, (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND relrowsecurity = false;"
```

Tabelas com RLS ligado e **0 policies** (`access_logs`, `founder_applications`, `payment_webhook_events`, etc.) são **intencionais**: só o backend com `service_role` acessa.
