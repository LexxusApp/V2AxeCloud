import fs from "fs";
import path from "path";

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === "node_modules" || f === ".git" || f === "dist") continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full);
    } else if (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".mjs")) {
      const content = fs.readFileSync(full, "utf8");
      if (content.includes("nome_terreiro") && content.includes("email") && (content.includes(" - ") || content.includes(" — "))) {
        console.log("Found in:", full);
      }
    }
  }
}

searchDir(".");
