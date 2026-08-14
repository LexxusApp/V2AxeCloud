import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");
const sourceDir = path.join(root, "assets-source");

async function replacePng(relative, width) {
  const source = path.join(publicDir, relative);
  const temporary = `${source}.optimized`;
  await sharp(source)
    .resize({ width, height: width, fit: "contain", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(temporary);
  await rename(temporary, source);
}

await replacePng("axecloud-trident.png", 256);

for (const size of [32, 48, 192, 512]) {
  await sharp(path.join(publicDir, "axecloud-trident.png"))
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(path.join(publicDir, `icon-${size}.png`));
}

await sharp(path.join(sourceDir, "og.png"))
  .resize(1200, 630, { fit: "cover" })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(publicDir, "og.jpg"));

const screenshotDir = path.join(publicDir, "screenshots", "current");
const screenshotSourceDir = path.join(sourceDir, "screenshots", "current");
await mkdir(screenshotDir, { recursive: true });
for (const name of ["giras-calendario", "galeria", "biblioteca", "almoxarifado"]) {
  await sharp(path.join(screenshotSourceDir, `${name}.png`))
    .webp({ quality: 82, effort: 6 })
    .toFile(path.join(screenshotDir, `${name}.webp`));
}

console.log("Assets otimizados para produção.");
