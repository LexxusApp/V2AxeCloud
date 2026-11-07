import fs from 'node:fs';
import path from 'node:path';

// 1. whatsappSendCore.ts
{
  const filePath = path.resolve('api/lib/whatsappSendCore.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    '.select("id, nome, cpf, tenant_id, lider_id, data_entrada")',
    '.select("id, nome, cpf, tenant_id, lider_id, data_entrada, email")'
  );
  content = content.replace(
    'email_filho: String(filho.email || variables.email_filho || "").trim(),',
    'email_filho: String((filho as any).email || variables.email_filho || "").trim(),'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('OK: whatsappSendCore.ts corrigido');
}

// 2. ChildProfileV3View.tsx
{
  const filePath = path.resolve('src/components/child-profile/ChildProfileV3View.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    '<InfoField label="E-mail de Acesso" value={child.email || EMPTY} />',
    "<InfoField label=\"E-mail de Acesso\" value={String((child as any)?.email || '') || EMPTY} />"
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('OK: ChildProfileV3View.tsx corrigido');
}
