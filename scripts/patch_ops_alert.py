with open('api/lib/opsAlertWhatsApp.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update resolveOpsAlertPhones
old_snippet = """function resolveOpsAlertPhones(): string[] {
  const raw = [
    process.env.WA_OPS_ALERT_PHONES,
    process.env.WA_OPS_ALERT_PHONE,
    process.env.AUTOPOST_WHATSAPP_TO,
  ]
    .map((v) => String(v || "").trim())
    .find(Boolean);
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[,;\\s]+/)) {
    const msisdn = normalizeBrazilMsisdn(part);
    if (msisdn && !out.includes(msisdn)) out.push(msisdn);
  }
  return out;
}"""

new_snippet = """function resolveOpsAlertPhones(): string[] {
  const raw = [
    process.env.WA_OPS_ALERT_PHONES,
    process.env.WA_OPS_ALERT_PHONE,
    process.env.AUTOPOST_WHATSAPP_TO,
  ]
    .map((v) => String(v || "").trim())
    .find(Boolean) || "5511920033501";
  const out: string[] = [];
  for (const part of raw.split(/[,;\\s]+/)) {
    const msisdn = normalizeBrazilMsisdn(part);
    if (msisdn && !out.includes(msisdn)) out.push(msisdn);
  }
  return out.length ? out : ["5511920033501"];
}"""

old_sanitize = """  const terreiro = String(opts.nome_terreiro || "Terreiro").trim().slice(0, 80);
  const zelador = String(opts.nome_zelador || "").trim().slice(0, 60);"""

new_sanitize = """  const terreiro = String(opts.nome_terreiro || "Terreiro").replace(/[\\r\\n\\t]+/g, " ").replace(/\\s{2,}/g, " ").trim().slice(0, 80);
  const zelador = String(opts.nome_zelador || "").replace(/[\\r\\n\\t]+/g, " ").replace(/\\s{2,}/g, " ").trim().slice(0, 60);"""

content_norm = content.replace('\r\n', '\n')
old_snippet_norm = old_snippet.replace('\r\n', '\n')
new_snippet_norm = new_snippet.replace('\r\n', '\n')
old_sanitize_norm = old_sanitize.replace('\r\n', '\n')
new_sanitize_norm = new_sanitize.replace('\r\n', '\n')

if old_snippet_norm in content_norm and old_sanitize_norm in content_norm:
    content_norm = content_norm.replace(old_snippet_norm, new_snippet_norm)
    content_norm = content_norm.replace(old_sanitize_norm, new_sanitize_norm)
    with open('api/lib/opsAlertWhatsApp.ts', 'w', encoding='utf-8') as f:
        f.write(content_norm)
    print('opsAlertWhatsApp.ts atualizado com sucesso!')
else:
    print('Snippet não encontrado.')
