import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("foto opcional do diretório retorna 204 e deixa o cliente usar o placeholder", () => {
  const source = readFileSync("api/lib/diretorioPublicRoutes.ts", "utf8");
  const handler = source.slice(source.indexOf('app.get("/api/v1/public/diretorio/foto/:slug"'));
  assert.match(handler, /res\.status\(204\)\.end\(\)/);
  assert.doesNotMatch(handler.slice(0, handler.indexOf('/** Terreiro individual')), /res\.status\(404\)\.end\(\)/);
});
