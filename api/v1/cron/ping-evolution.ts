const EVOLUTION_API_STATUS_URL = "https://evolution-api-production-fb8d.up.railway.app/";

function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await fetch(EVOLUTION_API_STATUS_URL, { method: "GET" });
  } catch (error) {
    console.error("[CRON] Erro ao pingar Evolution API:", error);
  }

  return sendJson(res, 200, { pinged: true });
}
