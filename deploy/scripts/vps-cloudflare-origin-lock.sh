#!/usr/bin/env bash
set -euo pipefail

# Protege portas Docker publicadas sem bloquear HTTPS de saída dos containers.
CHAIN="AXECLOUD-CF-ORIGIN"
ACTION="${1:-apply}"
PUBLIC_IFACE="${AXECLOUD_PUBLIC_IFACE:-$(ip route show default | awk '/default/ { print $5; exit }')}"

CF_IPV4=(
  173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22
)
CF_IPV6=(
  2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32
  2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
)

if [[ -z "${PUBLIC_IFACE}" ]]; then
  echo "Não foi possível detectar a interface pública." >&2
  exit 1
fi

delete_rule_if_present() {
  local command="$1"
  shift
  while "${command}" -C "$@" >/dev/null 2>&1; do
    "${command}" -D "$@"
  done
}

remove_legacy_rules() {
  local cidr
  delete_rule_if_present iptables DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
  delete_rule_if_present ip6tables DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
  delete_rule_if_present iptables DOCKER-USER -i "${PUBLIC_IFACE}" -p tcp -m multiport --dports 80,443 -j DROP
  delete_rule_if_present ip6tables DOCKER-USER -i "${PUBLIC_IFACE}" -p tcp -m multiport --dports 80,443 -j DROP
  for cidr in "${CF_IPV4[@]}"; do
    delete_rule_if_present iptables DOCKER-USER -s "${cidr}" -p tcp -m multiport --dports 80,443 -j ACCEPT
  done
  for cidr in "${CF_IPV6[@]}"; do
    delete_rule_if_present ip6tables DOCKER-USER -s "${cidr}" -p tcp -m multiport --dports 80,443 -j ACCEPT
  done
}

remove_managed_chain() {
  local command="$1"
  delete_rule_if_present "${command}" DOCKER-USER -i "${PUBLIC_IFACE}" -p tcp -m multiport --dports 80,443 -j "${CHAIN}"
  if "${command}" -nL "${CHAIN}" >/dev/null 2>&1; then
    "${command}" -F "${CHAIN}"
    "${command}" -X "${CHAIN}"
  fi
}

apply_family() {
  local command="$1"
  shift
  local ranges=("$@")
  local cidr
  "${command}" -N "${CHAIN}" 2>/dev/null || true
  "${command}" -F "${CHAIN}"
  for cidr in "${ranges[@]}"; do
    "${command}" -A "${CHAIN}" -s "${cidr}" -j ACCEPT
  done
  "${command}" -A "${CHAIN}" -j DROP
  delete_rule_if_present "${command}" DOCKER-USER -i "${PUBLIC_IFACE}" -p tcp -m multiport --dports 80,443 -j "${CHAIN}"
  "${command}" -I DOCKER-USER 1 -i "${PUBLIC_IFACE}" -p tcp -m multiport --dports 80,443 -j "${CHAIN}"
}

case "${ACTION}" in
  apply)
    remove_legacy_rules
    remove_managed_chain iptables
    remove_managed_chain ip6tables
    apply_family iptables "${CF_IPV4[@]}"
    apply_family ip6tables "${CF_IPV6[@]}"
    echo "Proteção Cloudflare aplicada na interface ${PUBLIC_IFACE}."
    ;;
  remove)
    remove_legacy_rules
    remove_managed_chain iptables
    remove_managed_chain ip6tables
    echo "Regras Docker gerenciadas removidas."
    ;;
  status)
    echo "Interface pública: ${PUBLIC_IFACE}"
    iptables -S DOCKER-USER
    iptables -S "${CHAIN}" 2>/dev/null || true
    ip6tables -S DOCKER-USER
    ip6tables -S "${CHAIN}" 2>/dev/null || true
    ;;
  *)
    echo "Uso: $0 {apply|remove|status}" >&2
    exit 2
    ;;
esac
