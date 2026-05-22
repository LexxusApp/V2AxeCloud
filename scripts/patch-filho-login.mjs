import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const filePath = path.join(root, "api", "index.ts");
let s = fs.readFileSync(filePath, "utf8");
const start = s.indexOf('app.post("/api/auth/filho-login", async (req, res) => {');
const end = s.indexOf("  // API Route: Save User Settings (Bypasses RLS)", start);
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}
const lineStart = s.lastIndexOf("\n", start) + 1;
const commentStart = s.lastIndexOf("// API Route: Filho", lineStart);
const blockStart = commentStart >= 0 ? s.lastIndexOf("\n", commentStart - 1) + 1 : lineStart;
const replacement = `  // API Route: Filho de Santo Login (handler seguro compartilhado)
  app.post("/api/auth/filho-login", filhoLoginRateLimit, (req, res) => {
    void handleFilhoLoginRoute(req, res);
  });

`;
s = s.slice(0, blockStart) + replacement + s.slice(end);
fs.writeFileSync(filePath, s);
console.log("filho-login replaced");
