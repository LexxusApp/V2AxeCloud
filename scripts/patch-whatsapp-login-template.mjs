import fs from 'node:fs';
import path from 'node:path';

// 1. whatsappMetaCloud.ts
{
  const filePath = path.resolve('api/lib/whatsappMetaCloud.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  const oldCode = `export function buildContaAtivaComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const v = variables || {};
  const registro = String(v.filho_login_id || "").trim();
  const templateName = resolveMetaTemplateName("dados_acesso");

  if (templateName === CONTA_MEMBRO_CADASTRO_TEMPLATE) {
    const credencialText = \`Registro: \${registro || "—"} · Senha: 6 primeiros dígitos do CPF · Link: https://axecloud.com.br/entrar?modo=filho\`;
    return [
      {
        type: "body",
        parameters: [
          textParam(String(v.nome_filho || nomeMembro || "Membro")),
          textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
          textParam(credencialText, 512),
        ],
      },
    ];
  }

  if (templateName === CONTA_MEMBRO_PORTAL_TEMPLATE) {
    const credencialText = \`Seu registro é \${registro || "—"}. A chave de entrada são os 6 primeiros dígitos do seu CPF.\`;
    return [
      {
        type: "body",
        parameters: [
          textParam(String(v.nome_filho || nomeMembro || "Membro")),
          textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
          textParam(credencialText, 512),
        ],
      },
    ];
  }`;

  const newCode = `export function buildContaAtivaComponents(
  nomeMembro: string,
  nomeTerreiro: string,
  variables?: Record<string, string | number>
): MetaTemplateComponent[] {
  const v = variables || {};
  const registro = String(v.filho_login_id || "").trim();
  const email = String(v.email_filho || "").trim();
  const templateName = resolveMetaTemplateName("dados_acesso");

  if (templateName === CONTA_MEMBRO_CADASTRO_TEMPLATE) {
    const loginDetail = email
      ? \`Login: \${email} (ou Registro: \${registro || "—"})\`
      : \`Login: seu WhatsApp ou Registro (\${registro || "—"})\`;
    const credencialText = \`\${loginDetail} · Senha: 6 primeiros dígitos do CPF · Link: https://axecloud.com.br/entrar?modo=filho\`;
    return [
      {
        type: "body",
        parameters: [
          textParam(String(v.nome_filho || nomeMembro || "Membro")),
          textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
          textParam(credencialText, 512),
        ],
      },
    ];
  }

  if (templateName === CONTA_MEMBRO_PORTAL_TEMPLATE) {
    const loginDetail = email
      ? \`Seu login é \${email} (ou registro \${registro || "—"}).\`
      : \`Seu login é seu WhatsApp ou registro \${registro || "—"}.\`;
    const credencialText = \`\${loginDetail} A chave de entrada são os 6 primeiros dígitos do seu CPF.\`;
    return [
      {
        type: "body",
        parameters: [
          textParam(String(v.nome_filho || nomeMembro || "Membro")),
          textParam(String(v.nome_terreiro || nomeTerreiro || "Terreiro")),
          textParam(credencialText, 512),
        ],
      },
    ];
  }`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldCode))) {
    content = norm(content).replace(norm(oldCode), norm(newCode));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: api/lib/whatsappMetaCloud.ts atualizado');
  } else {
    console.warn('WARN: oldCode não encontrado em whatsappMetaCloud.ts');
  }
}

// 2. whatsappSendCore.ts
{
  const filePath = path.resolve('api/lib/whatsappSendCore.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Adicionar email_filho em resolveCredentialsVariables
  const oldResolveCreds = `    nome_filho: variables.nome_filho || String(filho.nome || ""),
    filho_login_id: formatFilhoMatricula(String(filho.id), filho.data_entrada),
    senha_acesso: senhaAcesso,
  };`;

  const newResolveCreds = `    nome_filho: variables.nome_filho || String(filho.nome || ""),
    filho_login_id: formatFilhoMatricula(String(filho.id), filho.data_entrada),
    senha_acesso: senhaAcesso,
    email_filho: String(filho.email || variables.email_filho || "").trim(),
  };`;

  // Atualizar buildCredentialsAccessBlock
  const oldCredsBlock = `function buildCredentialsAccessBlock(variables: Record<string, string | number>): string {
  const loginId = String(variables.filho_login_id || "").trim();
  const senha = String(variables.senha_acesso || "").trim();
  const loginUrl = String(variables.login_url || resolveFilhoLoginPublicUrl()).trim();
  if (!loginId) return "";
  return (
    \`\\n\\n🔐 *Seu acesso:*\\nRegistro: \${loginId}\\nCódigo (6 dígitos do CPF): \${senha}\\nEntrar: \${loginUrl}\` +
    \`\\n\\nNo app: giras, mensalidade, obrigações, recados e chat com a casa.\` +
    \`\\nGuia: https://axecloud.com.br/instrucoes/membro\`
  );
}`;

  const newCredsBlock = `function buildCredentialsAccessBlock(variables: Record<string, string | number>): string {
  const loginId = String(variables.filho_login_id || "").trim();
  const email = String(variables.email_filho || "").trim();
  const senha = String(variables.senha_acesso || "").trim();
  const loginUrl = String(variables.login_url || resolveFilhoLoginPublicUrl()).trim();
  if (!loginId && !email) return "";
  const loginLine = email
    ? \`Login: \${email} (ou Registro: \${loginId})\`
    : \`Login: seu WhatsApp ou Registro (\${loginId})\`;
  return (
    \`\\n\\n🔐 *Seu acesso:*\\n\${loginLine}\\nCódigo (6 dígitos do CPF): \${senha}\\nEntrar: \${loginUrl}\` +
    \`\\n\\nNo app: giras, mensalidade, obrigações, recados e chat com a casa.\` +
    \`\\nGuia: https://axecloud.com.br/instrucoes/membro\`
  );
}`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldResolveCreds))) {
    content = norm(content).replace(norm(oldResolveCreds), norm(newResolveCreds));
    console.log('OK: resolveCredentialsVariables atualizado com email_filho');
  }
  if (norm(content).includes(norm(oldCredsBlock))) {
    content = norm(content).replace(norm(oldCredsBlock), norm(newCredsBlock));
    console.log('OK: buildCredentialsAccessBlock atualizado');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
