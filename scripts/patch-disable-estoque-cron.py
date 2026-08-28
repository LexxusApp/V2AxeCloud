#!/usr/bin/env python3
"""Desliga estoque crítico no cron WhatsApp (VPS). Idempotente."""
from __future__ import annotations

from pathlib import Path

PATH = Path("/opt/axecloud/api/lib/cronWhatsAppJobs.ts")
text = PATH.read_text(encoding="utf-8")

ESTOQUE_FN = """async function runEstoqueAlerts(sb: SupabaseClient): Promise<{ sent: number; skipped: number; errors: number }> {
  // HARD OFF — nao reativar sem aprovacao explicita.
  void sb;
  if (String(process.env.WA_DISABLE_ESTOQUE_ALERTS || "1").trim() === "1") {
    return { sent: 0, skipped: 0, errors: 0 };
  }
  return { sent: 0, skipped: 0, errors: 0 };
}"""

CRON_BLOCK = """export async function runWhatsAppCronJobs(sb: SupabaseClient) {
  const mensalidade = await runMensalidadeReminders(sb);
  // Estoque critico desligado (WA_DISABLE_ESTOQUE_ALERTS=1).
  const estoque = { sent: 0, skipped: 0, errors: 0 };
  void runEstoqueAlerts;
  const gira = await runGiraReminders(sb);
  return { mensalidade, estoque, gira };
}"""

import re

# Replace runEstoqueAlerts function body
fn_pat = re.compile(
    r"async function runEstoqueAlerts\(sb: SupabaseClient\): Promise<\{ sent: number; skipped: number; errors: number \}> \{[\s\S]*?\n\}\n\n(?=export async function dispatchTransmissaoAviso|export async function dispatchMuralWhatsApp|export async function dispatchGiraWhatsApp|export async function runGiraReminders|export async function runWhatsAppCronJobs)",
    re.MULTILINE,
)
if not fn_pat.search(text):
    # maybe already patched or different order — try alternate anchor
    fn_pat = re.compile(
        r"async function runEstoqueAlerts\(sb: SupabaseClient\): Promise<\{ sent: number; skipped: number; errors: number \}> \{[\s\S]*?\n\}\n",
        re.MULTILINE,
    )
new_text, n_fn = fn_pat.subn(ESTOQUE_FN + "\n\n", text, count=1)
if n_fn != 1:
    raise SystemExit(f"FAIL runEstoqueAlerts replace count={n_fn}")

cron_pat = re.compile(
    r"export async function runWhatsAppCronJobs\(sb: SupabaseClient\) \{[\s\S]*?\n\}\s*$",
    re.MULTILINE,
)
new_text, n_cron = cron_pat.subn(CRON_BLOCK + "\n", new_text, count=1)
if n_cron != 1:
    raise SystemExit(f"FAIL runWhatsAppCronJobs replace count={n_cron}")

PATH.write_text(new_text, encoding="utf-8")
print("PATCHED OK")
print("HARD OFF" in new_text)
print("await runEstoqueAlerts" in new_text)
