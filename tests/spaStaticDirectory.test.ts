import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("SPA não redireciona diretório estático para barra final", () => {
  const api = readFileSync("api/index.ts", "utf8");
  const server = readFileSync("server.ts", "utf8");
  assert.match(api, /express\.static\(\s*distPath\s*,\s*\{\s*redirect:\s*false\s*\}\s*\)/);
  assert.match(server, /express\.static\(\s*distPath\s*,\s*\{\s*redirect:\s*false\s*\}\s*\)/);
  assert.doesNotMatch(api, /express\.static\(\s*distPath\s*\)/);
  assert.doesNotMatch(server, /express\.static\(\s*distPath\s*\)/);
});
