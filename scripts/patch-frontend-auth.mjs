import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");

const files = [
  "App.tsx",
  "views/Financial.tsx",
  "views/Inventory.tsx",
  "views/Library.tsx",
  "views/NoticeBoard.tsx",
  "views/PerfilFilho.tsx",
  "views/MensalidadeFilho.tsx",
  "views/ChildProfile.tsx",
  "components/SubscriptionLock.tsx",
  "components/RegistrationCheckoutPanel.tsx",
  "hooks/useWebPush.ts",
];

for (const rel of files) {
  const filePath = path.join(srcDir, rel);
  if (!fs.existsSync(filePath)) continue;
  let s = fs.readFileSync(filePath, "utf8");
  if (!s.includes("authenticatedFetch")) {
    const importLine = "import { authFetch } from '../lib/authenticatedFetch';\n";
    const importLine2 = "import { authFetch } from '../../lib/authenticatedFetch';\n";
    if (rel.startsWith("components/") || rel.startsWith("hooks/")) {
      if (!s.includes("authFetch")) s = importLine + s;
    } else if (rel === "App.tsx") {
      s = s.replace(
        /(import \{ supabase \} from '\.\/lib\/supabase';)/,
        "$1\nimport { authFetch } from './lib/authenticatedFetch';"
      );
    } else {
      s = s.replace(/(import \{ supabase \} from '\.\.\/lib\/supabase';)/, "$1\nimport { authFetch } from '../lib/authenticatedFetch';");
    }
  }
  s = s.replace(/\bfetch\(([`'"])\/api\//g, "authFetch($1/api/");
  fs.writeFileSync(filePath, s);
  console.log("patched", rel);
}
