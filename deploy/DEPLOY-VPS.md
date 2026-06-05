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

```bash
cd /opt/axecloud
docker compose -f deploy/docker-compose.yml --env-file .env build
docker compose -f deploy/docker-compose.yml --env-file .env up -d
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f app
```

Teste: `curl -sS http://127.0.0.1:3000/api/plans` (via rede interna do host pode precisar `docker exec`).

## 4. Cron (ping Evolution)

No host (script já em `deploy/cron-ping-evolution.sh`):

```bash
chmod +x /opt/axecloud/deploy/cron-ping-evolution.sh
sed -i 's/\r$//' /opt/axecloud/deploy/cron-ping-evolution.sh   # se veio do Windows
(crontab -l 2>/dev/null | grep -v cron-ping-evolution; echo "*/10 * * * * /opt/axecloud/deploy/cron-ping-evolution.sh") | crontab -
```

O script usa a rede Docker (`http://app:3000/...`) para não seguir redirect HTTPS do Caddy para a Vercel enquanto o DNS ainda aponta para `76.76.21.21`.

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
