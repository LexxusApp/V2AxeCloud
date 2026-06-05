#!/bin/bash
# Hardening AxéCloud VPS — executar como root uma vez.
set -euo pipefail

echo "[1/5] Permissões do .env"
chmod 600 /opt/axecloud/.env
chown root:root /opt/axecloud/.env
ls -la /opt/axecloud/.env

echo "[2/5] fail2ban"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF
systemctl enable fail2ban
systemctl restart fail2ban
fail2ban-client status sshd || true

echo "[3/5] Netdata — apenas localhost + UFW"
mkdir -p /etc/netdata
if ! grep -q '^[[:space:]]*bind to' /etc/netdata/netdata.conf 2>/dev/null; then
  cat >> /etc/netdata/netdata.conf << 'EOF'

[web]
    bind to = 127.0.0.1
EOF
else
  sed -i 's/^[[:space:]]*bind to.*/    bind to = 127.0.0.1/' /etc/netdata/netdata.conf
fi
ufw deny 19999/tcp comment 'Block Netdata public' 2>/dev/null || ufw deny 19999/tcp
systemctl restart netdata

echo "[4/5] SSH — só chave, sem senha"
# cloud-init define PasswordAuthentication yes em 50-cloud-init.conf (primeira diretiva vence no OpenSSH)
sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config.d/50-cloud-init.conf 2>/dev/null || true
cat > /etc/ssh/sshd_config.d/99-axecloud-hardening.conf << 'EOF'
# AxéCloud VPS hardening
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no
EOF
sshd -t
systemctl restart ssh

echo "[5/5] Verificação"
echo "--- sshd efetivo ---"
sshd -T | grep -E 'passwordauthentication|permitrootlogin|pubkeyauthentication'
echo "--- portas públicas ---"
ss -tlnp | grep -E ':22|:80|:443|:19999' || true
echo "--- ufw ---"
ufw status numbered | head -20
echo "Hardening concluído."
