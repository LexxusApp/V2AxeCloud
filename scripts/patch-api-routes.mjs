import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api", "index.ts");
let s = fs.readFileSync(filePath, "utf8");

const patches = [
  [
    `  app.get("/api/children/:id", async (req, res) => {
    const childId = req.params.id;
    const userId = req.query.userId as string;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");
    
    console.log(\`[SERVER] GET /api/children/\${childId} request received. userId:\`, userId, "tenantId:", tenantIdFromQuery);

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );`,
    `  app.get("/api/children/:id", async (req, res) => {
    const childId = req.params.id;
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const userId = user.id;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );
      if (!tenantId) return res.status(403).json({ error: "Acesso negado" });`,
  ],
  [
    `  app.put("/api/children/:id", async (req, res) => {
    const childId = req.params.id;
    const userId = req.query.userId as string;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");
    const updateData = req.body;
    
    console.log(\`[SERVER] PUT /api/children/\${childId} request received. userId:\`, userId, "tenantId:", tenantIdFromQuery);

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );`,
    `  app.put("/api/children/:id", async (req, res) => {
    const childId = req.params.id;
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const userId = user.id;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");
    const updateData = pickAllowedChildFields(req.body || {});

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );
      if (!tenantId) return res.status(403).json({ error: "Acesso negado" });`,
  ],
  [
    `  app.get("/api/children", async (req, res) => {
    console.log(\`[SERVER] GET /api/children request received. Query:\`, req.query);
    const userId = req.query.userId as string;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");

    if (!userId) {
      console.log(\`[SERVER] GET /api/children - Missing userId\`);
      return res.status(400).json({ error: "UserId is required" });
    }

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );`,
    `  app.get("/api/children", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const userId = user.id;
    const tenantIdFromQuery = normalizeQueryTenantId(req.query.tenantId);
    const userRoleQ = String(req.query.userRole || "");

    try {
      const tenantId = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleQ,
        tenantIdFromQuery
      );
      if (!tenantId) return res.status(403).json({ error: "Acesso negado" });`,
  ],
  [
    `  app.get("/api/notices", async (req, res) => {
    const { tenantId } = req.query;
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      return res.status(400).json({ error: "tenantId é obrigatório" });
    }
    try {
      const resolvedId = await resolveLeaderId(tenantId as string);
      const { data, error } = await supabaseAdmin
        .from('mural_avisos')
        .select('*')
        .or(\`tenant_id.eq.\${resolvedId},tenant_id.eq.\${tenantId}\`)`,
    `  app.get("/api/notices", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    const tenantId = access.tenantId;
    try {
      const resolvedId = await resolveLeaderId(tenantId);
      const { data, error } = await supabaseAdmin
        .from('mural_avisos')
        .select('*')
        .or(\`tenant_id.eq.\${resolvedId},tenant_id.eq.\${tenantId}\`)`,
  ],
  [
    `  app.get("/api/inventory", async (req, res) => {
    const { tenantId } = req.query;
    try {
      let query = supabaseAdmin.from('almoxarifado').select('*').order('item', { ascending: true });
      if (tenantId) {
        query = query.or(\`tenant_id.eq.\${tenantId},lider_id.eq.\${tenantId}\`);
      }
      
      const { data, error } = await query;`,
    `  app.get("/api/inventory", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;
    const tenantId = access.tenantId;
    try {
      const query = supabaseAdmin
        .from('almoxarifado')
        .select('*')
        .order('item', { ascending: true })
        .or(\`tenant_id.eq.\${tenantId},lider_id.eq.\${tenantId}\`);
      const { data, error } = await query;`,
  ],
  [
    `  app.get("/api/transactions", async (req, res) => {
    const { tenantId, userId, userRole, limit, userEmail: userEmailQ } = req.query;
    try {
      const userRoleStr = String(userRole || "").toLowerCase();
      const tenantIdRaw = normalizeQueryTenantId(tenantId);
      const limNum = limit ? Number(limit) : 150;

      if (userRoleStr === "filho") {
        let jwtUid = "";
        let jwtEm = "";
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const token = authHeader.replace(/^Bearer\\s+/i, "").trim();
          if (token) {
            const { user } = await verifyUser(token);
            if (user?.id) jwtUid = user.id;
            jwtEm = String((user as { email?: string | null }).email || "").trim().toLowerCase();
          }
        }`,
    `  app.get("/api/transactions", async (req, res) => {
    const { tenantId, userRole, limit, userEmail: userEmailQ } = req.query;
    const authUser = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!authUser) return;
    try {
      const userRoleStr = String(userRole || "").toLowerCase();
      const tenantIdRaw = normalizeQueryTenantId(tenantId);
      const limNum = limit ? Number(limit) : 150;
      const userId = authUser.id;

      if (userRoleStr === "filho") {
        const jwtUid = authUser.id;
        const jwtEm = String(authUser.email || "").trim().toLowerCase();`,
  ],
  [
    `      const effectiveTenant = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId as string,
        userRoleStr,
        tenantIdRaw
      );

      let query = supabaseAdmin.from('financeiro').select('*').order('data', { ascending: false });

      if (effectiveTenant) {
        query = query.or(\`tenant_id.eq.\${effectiveTenant},lider_id.eq.\${effectiveTenant}\`);
      }`,
    `      const effectiveTenant = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleStr,
        tenantIdRaw
      );
      if (!effectiveTenant) return res.status(403).json({ error: "Acesso negado" });

      let query = supabaseAdmin.from('financeiro').select('*').order('data', { ascending: false });
      query = query.or(\`tenant_id.eq.\${effectiveTenant},lider_id.eq.\${effectiveTenant}\`);`,
  ],
  [
    `  app.post("/api/event-guests/update-status", async (req, res) => {
    const { guestId, status } = req.body;
    try {
      if (!guestId || !status) return res.status(400).json({ error: "Missing guestId or status" });`,
    `  app.post("/api/event-guests/update-status", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const { guestId, status } = req.body;
    try {
      if (!guestId || !status) return res.status(400).json({ error: "Missing guestId or status" });`,
  ],
  [
    `  app.post("/api/webhooks/kiwify", express.json(), async (req, res) => {
    const payload = req.body;`,
    `  app.post("/api/webhooks/kiwify", webhookRateLimit, express.json(), async (req, res) => {
    if (!verifyKiwifyWebhook(req)) {
      return res.status(401).json({ error: "Webhook não autorizado" });
    }
    const payload = req.body;`,
  ],
  [
    `      const config = req.body;
      const safeTemplates = normalizeWhatsAppTemplates(config?.templates);
      const { error } = await supabaseAdmin
        .from('whatsapp_config')
        .upsert({
          ...config,
          templates: safeTemplates,
          id: user.id,
          tenant_id: user.id,
          updated_at: new Date().toISOString()
        });`,
    `      const { instance_name, evolution_api_url, templates } = req.body || {};
      const safeTemplates = normalizeWhatsAppTemplates(templates);
      const { error } = await supabaseAdmin
        .from('whatsapp_config')
        .upsert({
          instance_name,
          evolution_api_url,
          templates: safeTemplates,
          id: user.id,
          tenant_id: user.id,
          updated_at: new Date().toISOString()
        });`,
  ],
  [
    `      const { tipo, filhoId, variables, forcePhone } = req.body;

      const { data: config } = await supabaseAdmin
        .from('whatsapp_config')
        .select('*')
        .eq('tenant_id', user.id)
        .single();

      let phone = forcePhone;
      if (!phone && filhoId) {
        const { data: filho } = await supabaseAdmin
          .from('filhos_de_santo')
          .select('whatsapp_phone')
          .eq('id', filhoId)
          .single();
        phone = filho?.whatsapp_phone;
      }`,
    `      const { tipo, filhoId, variables } = req.body;

      const { data: config } = await supabaseAdmin
        .from('whatsapp_config')
        .select('*')
        .eq('tenant_id', user.id)
        .single();

      let phone: string | undefined;
      if (filhoId) {
        const { data: filho } = await supabaseAdmin
          .from('filhos_de_santo')
          .select('whatsapp_phone, tenant_id, lider_id')
          .eq('id', filhoId)
          .single();
        const okFilho = filho && await assertZeladorTenantAccess(
          supabaseAdmin,
          resolveLeaderId,
          user.id,
          String(filho.tenant_id || filho.lider_id || user.id)
        );
        if (!okFilho) return res.status(403).json({ error: "Filho não pertence ao seu terreiro" });
        phone = filho?.whatsapp_phone;
      }`,
  ],
];

let applied = 0;
for (const [from, to] of patches) {
  if (!s.includes(from)) {
    console.warn("PATCH MISS:", from.slice(0, 60).replace(/\n/g, " "));
    continue;
  }
  s = s.replace(from, to);
  applied++;
}
fs.writeFileSync(filePath, s);
console.log(`Applied ${applied}/${patches.length} patches`);
