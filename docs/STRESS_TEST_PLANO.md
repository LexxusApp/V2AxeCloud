# Plano de stress test — AxéCloud (VPS Contabo)

Objetivo: medir quantos acessos simultâneos a stack aguenta **sem derrubar produção** e identificar o gargalo (Caddy, app Node, Supabase, CPU/RAM da VPS).

**Produção:** `https://axecloud.com.br` · VPS `66.94.103.197` · stack Docker (`caddy`, `app`, `marketing`, `redis`, `evolution`, `crowdsec`).

---

## Regras antes de começar

1. **Horário de baixo tráfego** (madrugada ou combinado) — terreiros reais usam o sistema.
2. **Nunca** incluir no teste: `/api/whatsapp/*`, webhooks, checkout, `create-tenant`, broadcast, upload pesado.
3. **CrowdSec + Caddy** podem **banir o IP** de quem dispara o teste se for agressivo demais. Use rampa gradual; se receber 403/429, pare e aguarde ~15 min.
4. **Supabase** é externo — acima de certo volume o limite pode ser do banco/plano, não da VPS.
5. Rode o teste **de outra máquina** (seu PC), não de dentro da VPS (senão mede localhost, não o caminho real).

---

## O que testar (rotas)

### Camada A — Público / leve (sem login)

| Rota | Método | Peso | O que mede |
|------|--------|------|------------|
| `/api/ping` | GET | 20% | Node app vivo |
| `/api/health-check` | GET | 20% | Health JSON |
| `/api/public-config` | GET | 10% | Config runtime |
| `/` | GET | 25% | Landing (marketing container) |
| `/login` | GET | 15% | Shell SPA (app container) |
| `/api/plans` | GET | 10% | API + rate limit leve |

### Camada B — Autenticado (opcional, com token de teste)

| Rota | Método | Peso | O que mede |
|------|--------|------|------------|
| `/api/tenant-info` | GET | 40% | Sessão + Supabase |
| `/api/whatsapp/status` | GET | 20% | App + Evolution (só leitura) |
| `/api/whatsapp/logs` | GET | 20% | Leitura logs |
| `/api/v1/financial/mensalidades` | GET | 20% | Query financeira |

> Token: faça login no painel com conta de **teste/demo**, copie o `access_token` do Supabase (DevTools → Application → ou `supabase.auth.getSession()` no console). Exporte `STRESS_AUTH_TOKEN=eyJ...` antes do k6.

### Camada C — Não testar

- POST/PUT/DELETE em dados reais
- WhatsApp send/broadcast
- Upload galeria/biblioteca
- Admin console
- Webhooks Meta/Evolution

---

## Cenários k6 (scripts em `scripts/stress/`)

| Script | VUs máx | Duração | Uso |
|--------|---------|---------|-----|
| `k6-smoke.js` | 5 | 1 min | Sanity check pós-deploy |
| `k6-baseline.js` | 30 | 5 min | Tráfego misto realista |
| `k6-ramp.js` | até 200 | ~12 min | Achar teto (rampa + sustain) |

### Instalar k6 (Windows)

```powershell
winget install k6 --source winget
```

Após instalar, **abra um terminal novo** (ou reinicie o Cursor) para o PATH atualizar. Se ainda falhar, use os scripts `.ps1` em `scripts/stress/` — eles encontram o k6 em `C:\Program Files\k6\k6.exe` automaticamente.

### Executar (do seu PC)

```powershell
cd C:\Users\Administrador\Desktop\AxecloudV2

# Atalhos (recomendado no Windows)
.\scripts\stress\run-smoke.ps1
.\scripts\stress\run-baseline.ps1
.\scripts\stress\run-ramp.ps1

# Ou direto (terminal novo, com k6 no PATH)
$env:BASE_URL = "https://axecloud.com.br"
k6 run scripts/stress/k6-smoke.js
k6 run scripts/stress/k6-baseline.js
k6 run scripts/stress/k6-ramp.js

# Com auth (opcional)
$env:STRESS_AUTH_TOKEN = "seu_jwt_aqui"
.\scripts\stress\run-baseline.ps1
```

---

## Monitorar a VPS durante o teste

Em **outro terminal**, SSH na VPS e rode:

```bash
ssh -i ~/.ssh/contabo_axecloud root@66.94.103.197
cd /opt/axecloud
bash deploy/scripts/stress-monitor-vps.sh
```

Ou snapshot único:

```bash
docker stats --no-stream
free -h
uptime
```

### O que observar

| Métrica | Onde | Sinal de problema |
|---------|------|-------------------|
| CPU app | `docker stats deploy-app-1` | > 85% sustentado |
| RAM | `free -h` | swap em uso |
| Latência p95 | saída k6 | > 3s em `/api/ping` |
| Taxa de erro | k6 `http_req_failed` | > 2% |
| HTTP 429 | k6 / logs Caddy | rate limit Caddy (300 req/min/IP na API geral) |
| HTTP 403 | resposta | possível ban CrowdSec |
| Supabase | dashboard Supabase | connection pool / timeouts |

---

## Limites conhecidos da infra (referência)

- **Caddy** `api_general`: ~**300 req/min por IP** em `/api/*`
- **Caddy** rotas sensíveis (whatsapp, auth): ~**60 req/min por IP**
- **CrowdSec**: comportamento tipo scanner → ban temporário
- **App Node**: single container; escala vertical (mais CPU/RAM) antes de horizontal
- **Supabase**: plano free/pro tem limites de conexões e API — consultar dashboard durante pico

Por isso o **teto “real” por IP externo** costuma aparecer entre **~5 req/s sustentados** na API (300/min) antes dos 429, **independente** da VPS aguentar mais.

Para medir **capacidade bruta da VPS** (sem rate limit), rode um teste **interno** (só em janela combinada):

```bash
# Na VPS — atinge app direto, bypass Caddy
docker exec deploy-app-1 wget -qO- http://127.0.0.1:3000/api/ping
# k6 instalado na VPS ou ab contra http://app:3000 de outro container na rede docker
```

---

## Como ler o resultado do k6

Ao final, k6 imprime:

```
http_req_duration..............: avg=120ms  p(95)=450ms
http_req_failed..............: 0.50%
http_reqs....................: 15000 (50/s)
vus..........................: 30
```

| Campo | Bom | Atenção | Crítico |
|-------|-----|---------|---------|
| `p(95)` ping/health | < 500 ms | 500 ms – 2 s | > 2 s |
| `http_req_failed` | < 1% | 1–5% | > 5% |
| 429 count | 0 | alguns | muitos = rate limit |

**Interpretação:**

- **429 cedo, CPU baixa** → gargalo = Caddy/CrowdSec, não VPS.
- **CPU/RAM alta, latência sobe, poucos 429** → gargalo = app ou VPS.
- **401/403 com token** → token expirado ou ban.
- **500 + timeouts com CPU ok** → provável Supabase ou Evolution.

---

## Roteiro sugerido (1ª execução)

1. **Smoke** (`k6-smoke.js`) — confirmar que scripts funcionam.
2. **Baseline 30 VUs** — anotar p95 e req/s.
3. **Monitor VPS** em paralelo — anotar pico CPU/RAM do `deploy-app-1`.
4. **Ramp** (`k6-ramp.js`) — parar quando `http_req_failed` > 5% ou aparecer 429 em massa.
5. (Opcional) Repetir baseline **com** `STRESS_AUTH_TOKEN` — compara carga autenticada.

Registre em planilha: data, script, VUs, req/s, p95, erros, CPU max, conclusão.

---

## Próximos passos se precisar escalar

- Aumentar rate limit Caddy só após entender pico legítimo de terreiros.
- Redis cache em rotas read-heavy (`/api/plans`, tenant-info parcial).
- Segundo container `app` + load balance no Caddy (quando CPU app for o gargalo).
- Upgrade VPS Contabo (vCPU/RAM) se `docker stats` mostrar app saturado antes do rate limit.
