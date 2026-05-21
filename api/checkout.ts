/**
 * Checkout EFI: config, context, pix, card, status.
 */
import express from "express";
import { registerEfiCheckoutRoutes } from "./lib/efiCheckoutRoutes.js";
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { getDiscreteSupabaseAdmin } from "./lib/discreteSupabase.js";
import { restoreReqUrl } from "./lib/restoreReqUrl.js";

let appPromise: Promise<express.Express> | null = null;

async function getApp(): Promise<express.Express> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    const sb = getDiscreteSupabaseAdmin();
    if (!sb) {
      app.use((_req, res) => {
        res.status(503).json({ error: "Supabase não configurado na função da Vercel." });
      });
      return app;
    }
    registerEfiCheckoutRoutes(app, { supabaseAdmin: sb });
    return app;
  })();
  return appPromise;
}

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;
  restoreReqUrl(req, "/api/v1/checkout/efi");
  const app = await getApp();
  return app(req, res);
}
