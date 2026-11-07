import fs from 'node:fs';
import path from 'node:path';

// 1. Atualizar api/lib/tenantAccess.ts para normalizar e-mail
{
  const filePath = path.resolve('api/lib/tenantAccess.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  const oldPiece = `    if (key === "whatsapp_phone" && typeof value === "string") {`;
  const newPiece = `    if (key === "email") {
      const emailStr = String(value || "").trim().toLowerCase();
      out[key] = emailStr || null;
      continue;
    }

    if (key === "whatsapp_phone" && typeof value === "string") {`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (norm(content).includes(norm(oldPiece)) && !content.includes('key === "email"')) {
    content = norm(content).replace(norm(oldPiece), norm(newPiece));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('OK: api/lib/tenantAccess.ts atualizado');
  } else {
    console.log('INFO: tenantAccess.ts já tem normalização de email ou não precisou de ajuste');
  }
}

// 2. Atualizar api/lib/filhoLoginRoute.ts com findChildSmart
{
  const filePath = path.resolve('api/lib/filhoLoginRoute.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  const smartFn = `
async function findChildSmart(
  sb: SupabaseClient,
  identifierInput: string,
  cpfPrefix: string
): Promise<{ child: any | null; ambiguous: boolean; method: 'email' | 'phone' | 'matricula' }> {
  const raw = String(identifierInput || "").trim();
  const cpfDigits = String(cpfPrefix || "").replace(/\\D/g, "");

  // 1. Busca por E-mail (se contiver @)
  if (raw.includes("@") && raw.length >= 5) {
    const cleanEmail = raw.toLowerCase().trim();
    const { data, error } = await sb
      .from("filhos_de_santo")
      .select("id, cpf, user_id, nome, email, tenant_id, lider_id")
      .ilike("email", cleanEmail);
    if (error) throw error;

    const matchingCpf = (data || []).filter((c) => {
      const cleanCpf = String(c.cpf || "").replace(/\\D/g, "");
      return cleanCpf.startsWith(cpfDigits);
    });

    if (matchingCpf.length === 1) return { child: matchingCpf[0], ambiguous: false, method: 'email' };
    if (matchingCpf.length > 1) return { child: null, ambiguous: true, method: 'email' };
    return { child: null, ambiguous: false, method: 'email' };
  }

  // 2. Busca por WhatsApp / Telefone nacional
  const cleanDigits = raw.replace(/\\D/g, "");
  if (cleanDigits.length >= 10 && cleanDigits.length <= 13 && !raw.toUpperCase().startsWith("AXC-")) {
    const nationalNumber = cleanDigits.startsWith("55") && cleanDigits.length >= 12
      ? cleanDigits.slice(2)
      : cleanDigits;
    const last8 = nationalNumber.slice(-8);

    const { data, error } = await sb
      .from("filhos_de_santo")
      .select("id, cpf, user_id, nome, whatsapp_phone, tenant_id, lider_id")
      .ilike("whatsapp_phone", \`%\${last8}%\`);
    if (error) throw error;

    const matchingCpf = (data || []).filter((c) => {
      const cleanCpf = String(c.cpf || "").replace(/\\D/g, "");
      return cleanCpf.startsWith(cpfDigits);
    });

    if (matchingCpf.length === 1) return { child: matchingCpf[0], ambiguous: false, method: 'phone' };
    if (matchingCpf.length > 1) return { child: null, ambiguous: true, method: 'phone' };
    return { child: null, ambiguous: false, method: 'phone' };
  }

  // 3. Fallback: Registro / Matrícula tradicional (AXC-ANO-XXXX ou UUID)
  const res = await findChildByIdPrefix(sb, raw, cpfDigits);
  return { ...res, method: 'matricula' };
}
`;

  // Inserir findChildSmart após findChildByIdPrefix
  const targetAfterFind = `  if (matches.length === 1) return { child: matches[0], ambiguous: false };\n  if (matches.length > 1) return { child: null, ambiguous: true };\n  return { child: null, ambiguous: false };\n}`;

  const norm = (s) => s.replace(/\r\n/g, '\n');
  if (!content.includes('findChildSmart')) {
    if (norm(content).includes(norm(targetAfterFind))) {
      content = norm(content).replace(norm(targetAfterFind), norm(targetAfterFind) + '\n' + norm(smartFn));
      console.log('OK: findChildSmart inserido em filhoLoginRoute.ts');
    } else {
      console.warn('WARN: Não foi possível localizar targetAfterFind em filhoLoginRoute.ts');
    }
  }

  // Atualizar a validação e chamada no handleFilhoLoginRoute
  const oldHandleBody = `    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    let { childId, cpfPrefix } = body as { childId?: string; cpfPrefix?: string };

    const childIdStr = String(childId || "").trim();
    childIdRaw = filhoLoginRateLimitKey(childIdStr);
    cpfPrefix = String(cpfPrefix || "").replace(/\\D/g, "");

    if (!childIdStr || cpfPrefix.length !== CPF_PREFIX_LEN) {
      return sendJson(res, 400, {
        error: \`Registro (AXC-ANO-CÓDIGO) e os \${CPF_PREFIX_LEN} primeiros dígitos do CPF são obrigatórios.\`,
      });
    }

    if (!isValidFilhoLoginId(childIdStr)) {
      return sendJson(res, 400, {
        error: "Informe o registro (ex.: AXC-2021-B2CA). Pode digitar com ou sem hífen.",
      });
    }

    if (filhoLoginIsLocked(childIdRaw, req)) {
      return sendJson(res, 429, {
        error: "Muitas tentativas incorretas para este ID. Aguarde 30 minutos.",
      });
    }

    const { child, ambiguous } = await findChildByIdPrefix(supabaseAdmin, childIdStr, cpfPrefix);`;

  const newHandleBody = `    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    let { childId, cpfPrefix, identifier } = body as { childId?: string; cpfPrefix?: string; identifier?: string };

    const loginIdStr = String(identifier || childId || "").trim();
    childIdRaw = loginIdStr.toLowerCase().replace(/[^a-z0-9@._-]/g, "");
    cpfPrefix = String(cpfPrefix || "").replace(/\\D/g, "");

    if (!loginIdStr || cpfPrefix.length !== CPF_PREFIX_LEN) {
      return sendJson(res, 400, {
        error: \`Informe seu E-mail, WhatsApp ou Registro, e os \${CPF_PREFIX_LEN} primeiros dígitos do CPF.\`,
      });
    }

    const isEmail = loginIdStr.includes("@");
    const digitsOnly = loginIdStr.replace(/\\D/g, "");
    const isPhone = digitsOnly.length >= 10 && digitsOnly.length <= 13 && !loginIdStr.toUpperCase().startsWith("AXC-");

    if (!isEmail && !isPhone && !isValidFilhoLoginId(loginIdStr)) {
      return sendJson(res, 400, {
        error: "Informe seu E-mail, WhatsApp ou Registro (ex.: AXC-2021-B2CA).",
      });
    }

    if (filhoLoginIsLocked(childIdRaw, req)) {
      return sendJson(res, 429, {
        error: "Muitas tentativas incorretas para este usuário. Aguarde 30 minutos.",
      });
    }

    const { child, ambiguous, method } = await findChildSmart(supabaseAdmin, loginIdStr, cpfPrefix);`;

  if (norm(content).includes(norm(oldHandleBody))) {
    content = norm(content).replace(norm(oldHandleBody), norm(newHandleBody));
    console.log('OK: handleFilhoLoginRoute atualizado com busca inteligente');
  } else {
    console.warn('WARN: Não foi possível localizar oldHandleBody em filhoLoginRoute.ts');
  }

  // Atualizar auditFilhoLoginSuccess para aceitar method
  content = content.replace(
    'await auditFilhoLoginSuccess(req, { ...child, user_id: authUser.id });',
    'await auditFilhoLoginSuccess(req, { ...child, user_id: authUser.id }, method);'
  );
  content = content.replace(
    'await auditFilhoLoginSuccess(req, { ...child, user_id: newUser.user.id });',
    'await auditFilhoLoginSuccess(req, { ...child, user_id: newUser.user.id }, method);'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('OK: api/lib/filhoLoginRoute.ts salvo com sucesso');
}
