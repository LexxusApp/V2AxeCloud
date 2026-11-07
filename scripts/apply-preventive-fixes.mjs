import fs from 'fs';
import path from 'path';

const root = path.resolve('C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2');

// 1. Fix giraOperationsRoutes.ts
{
  const filePath = path.join(root, 'api/lib/giraOperationsRoutes.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // requireTenantReadAccess with allowMissingTenant: true
  content = content.replace(
    'const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);\n    if (!access) return;',
    'const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId, { allowMissingTenant: true });\n    if (!access) return;'
  );
  content = content.replace(
    'const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);\r\n    if (!access) return;',
    'const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId, { allowMissingTenant: true });\r\n    if (!access) return;'
  );

  // return res.json({ data: [] }) instead of 400 for non-filho without filhoId
  content = content.replace(
    'return res.status(400).json({ error: "filhoId required" });',
    'return res.json({ data: [] });'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated giraOperationsRoutes.ts');
}

// 2. Fix api/index.ts
{
  const filePath = path.join(root, 'api/index.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    'app.get("/api/notices", async (req, res) => {\n    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);',
    'app.get("/api/notices", async (req, res) => {\n    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId, { allowMissingTenant: true });'
  );
  content = content.replace(
    'app.get("/api/notices", async (req, res) => {\r\n    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);',
    'app.get("/api/notices", async (req, res) => {\r\n    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId, { allowMissingTenant: true });'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated api/index.ts');
}

// 3. Fix NoticeBoard.tsx
{
  const filePath = path.join(root, 'src/views/NoticeBoard.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    "const response = await authFetch(`/api/notices?tenantId=${tenantId || ''}`);",
    "const url = tenantId ? `/api/notices?tenantId=${encodeURIComponent(tenantId)}` : '/api/notices';\n      const response = await authFetch(url);"
  );
  content = content.replace(
    "const response = await authFetch(`/api/notices?tenantId=${tenantId || ''}`);",
    "const url = tenantId ? `/api/notices?tenantId=${encodeURIComponent(tenantId)}` : '/api/notices';\r\n      const response = await authFetch(url);"
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated NoticeBoard.tsx');
}

// 4. Fix PerfilFilho.tsx
{
  const filePath = path.join(root, 'src/views/PerfilFilho.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    "  // 3. Mural — feed central (estilo rede social)\n  useEffect(() => {\n    let cancelled = false;",
    "  // 3. Mural — feed central (estilo rede social)\n  useEffect(() => {\n    if (!tenantId) return;\n    let cancelled = false;"
  );
  content = content.replace(
    "  // 3. Mural — feed central (estilo rede social)\r\n  useEffect(() => {\r\n    let cancelled = false;",
    "  // 3. Mural — feed central (estilo rede social)\r\n  useEffect(() => {\r\n    if (!tenantId) return;\r\n    let cancelled = false;"
  );

  content = content.replace(
    "const res = await authFetch(`/api/notices?tenantId=${tenantId || ''}`);",
    "const res = await authFetch(`/api/notices?tenantId=${encodeURIComponent(tenantId)}`);"
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated PerfilFilho.tsx');
}
