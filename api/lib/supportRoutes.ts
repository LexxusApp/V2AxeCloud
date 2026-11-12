import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Express, Request, RequestHandler, Response } from "express";
import { requireAuthOrRespond } from "./requireAuth.js";
import { isValidUuid, resolveFilhoHouseRefs } from "./tenantAccess.js";
import { createRateLimit } from "./rateLimit.js";

type Actor = { user: User; profile?: { id: string; tenant_id: string | null; nome_terreiro: string | null; zelador: string | null } };
type Authenticate = (req: Request, res: Response) => Promise<Actor | null>;
const summaryFields = "id,subject,house_name,owner_name,status,created_at,updated_at";
const messageFields = "id,author_role,body,created_at";
const limitWrites = createRateLimit({
  windowMs: 60_000, max: 30, keyPrefix: "support-messages",
  message: { error: "Aguarde um minuto antes de enviar outra mensagem." },
});

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function registerSupportRoutes(app: Express, { supabaseAdmin: db }: { supabaseAdmin: SupabaseClient }) {
  registerTicketRoutes(app, db, "/api/v1/support", async (req, res) => {
    const user = await requireAuthOrRespond(db, req, res);
    if (!user) return null;
    const { data: profile, error } = await db.from("perfil_lider")
      .select("id,tenant_id,nome_terreiro,zelador").eq("id", user.id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!profile || await resolveFilhoHouseRefs(db, user)) {
      res.status(403).json({ error: "Acesso restrito à zeladoria." });
      return null;
    }
    return { user, profile };
  }, false);
}

export function registerAdminSupportRoutes(app: Express, db: SupabaseClient, authenticate: Authenticate) {
  registerTicketRoutes(app, db, "/api/admin-console/support", authenticate, true);
}

function registerTicketRoutes(app: Express, db: SupabaseClient, path: string, authenticate: Authenticate, admin: boolean) {
  const scoped = (req: Request, res: Response, actor: Actor) => {
    const id = String(req.params.id || "");
    let query = db.from("support_tickets").select(summaryFields + ",description").eq("id", id);
    if (!admin) query = query.eq("owner_id", actor.user.id);
    return query.maybeSingle().then(({ data, error }) => {
      if (error) throw error;
      if (!data) res.status(404).json({ error: "Chamado não encontrado." });
      return data;
    });
  };

  const route = (handle: (req: Request, res: Response, actor: Actor) => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      try {
        const actor = await authenticate(req, res);
        if (!actor) return;
        if (req.params.id && !isValidUuid(String(req.params.id))) {
          res.status(404).json({ error: "Chamado não encontrado." });
          return;
        }
        await handle(req, res, actor);
      } catch (error) {
        console.error("[support]", error);
        res.status(500).json({ error: "Não foi possível carregar ou salvar o chamado. Tente novamente." });
      }
    };

  app.get(path, route(async (req, res, actor) => {
    const page = Math.max(0, Math.min(1000, Math.floor(Number(req.query.page) || 0)));
    let query = db.from("support_tickets").select(summaryFields);
    if (!admin) query = query.eq("owner_id", actor.user.id);
    const { data, error } = await query.order("updated_at", { ascending: false }).order("id", { ascending: false })
      .range(page * 30, page * 30 + 30);
    if (error) throw error;
    return res.json({ tickets: data.slice(0, 30), hasMore: data.length > 30 });
  }));

  if (!admin) {
    app.get(path + "/notifications", route(async (_req, res, actor) => {
      const { data, error } = await db.from("support_messages")
        .select("id,ticket_id,created_at,support_tickets!inner(subject)")
        .eq("support_tickets.owner_id", actor.user.id).eq("author_role", "support")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return res.json({ data: data.map(row => ({
        id: "suporte:" + row.id, ticketId: row.ticket_id, created_at: row.created_at,
        type: "support", title: "Nova resposta do suporte",
        body: (row.support_tickets as unknown as { subject: string }).subject,
      })) });
    }));

    app.post(path, limitWrites, route(async (req, res, { user, profile }) => {
      const id = clean(req.body?.id);
      const subject = clean(req.body?.subject);
      const description = clean(req.body?.description);
      if (!profile || !isValidUuid(id) || subject.length < 3 || subject.length > 120 ||
          description.length < 5 || description.length > 4000) {
        return res.status(422).json({ error: "Informe o assunto e descreva o problema." });
      }
      const { error } = await db.from("support_tickets").upsert({
        id, owner_id: user.id, tenant_id: profile.tenant_id || profile.id,
        house_name: profile.nome_terreiro || "Terreiro",
        owner_name: profile.zelador || user.email || "Zeladoria", subject, description,
      }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      const { data, error: readError } = await db.from("support_tickets")
        .select("id,subject,description").eq("id", id).eq("owner_id", user.id).maybeSingle();
      if (readError) throw readError;
      if (!data || data.subject !== subject || data.description !== description) {
        return res.status(409).json({ error: "Este protocolo já está em uso." });
      }
      return res.status(201).json({ id });
    }));
  }

  app.get(path + "/:id", route(async (req, res, actor) => {
    const ticket = await scoped(req, res, actor);
    if (!ticket) return;
    const messages = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("support_messages").select(messageFields)
        .eq("ticket_id", req.params.id).order("created_at").order("id").range(offset, offset + 499);
      if (error) throw error;
      messages.push(...data);
      if (data.length < 500) break;
    }
    return res.json({ ticket, messages });
  }));

  app.post(path + "/:id/messages", limitWrites, route(async (req, res, actor) => {
    const id = clean(req.body?.id);
    const body = clean(req.body?.body);
    if (!isValidUuid(id) || !body || body.length > 4000) {
      return res.status(422).json({ error: "Escreva uma mensagem de até 4.000 caracteres." });
    }
    const ticket = await scoped(req, res, actor);
    if (!ticket) return;
    const { error } = await db.from("support_messages").upsert({
      id, ticket_id: req.params.id, body, author_id: actor.user.id,
      author_role: admin ? "support" : "owner",
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    const { data, error: readError } = await db.from("support_messages").select(messageFields)
      .eq("id", id).eq("ticket_id", req.params.id).eq("author_id", actor.user.id).maybeSingle();
    if (readError) throw readError;
    if (!data || data.body !== body || data.author_role !== (admin ? "support" : "owner")) {
      return res.status(409).json({ error: "Esta mensagem já foi usada em outro envio." });
    }
    return res.status(201).json({ message: data });
  }));
}
