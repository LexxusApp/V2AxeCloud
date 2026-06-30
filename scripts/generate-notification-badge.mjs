/**
 * Gera public/notification-badge.png — silhueta branca para barra de status Android.
 * Requer: silhueta branca (#FFF) em fundo transparente, sem cores.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'public', 'notification-badge.png');

// Silhueta inspirada no ícone PWA: bússola + casa + espiral (recorte transparente).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <mask id="houseMask">
      <rect width="96" height="96" fill="white"/>
      <path
        fill="black"
        d="M44 50c0-4 8-4 8 0s-8 4-8 8 8 4 8 8-8 4-8 0"
      />
    </mask>
  </defs>
  <g fill="#FFFFFF">
    <polygon points="48,8 52,15 48,22 44,15"/>
    <polygon points="48,74 52,81 48,88 44,81"/>
    <polygon points="8,48 15,52 22,48 15,44"/>
    <polygon points="74,48 81,52 88,48 81,44"/>
    <path
      fill="none"
      stroke="#FFFFFF"
      stroke-width="3.5"
      stroke-linecap="round"
      d="M48 18 A30 30 0 0 1 78 48"
    />
    <path
      fill="none"
      stroke="#FFFFFF"
      stroke-width="3.5"
      stroke-linecap="round"
      d="M78 48 A30 30 0 0 1 48 78"
    />
    <path
      fill="none"
      stroke="#FFFFFF"
      stroke-width="3.5"
      stroke-linecap="round"
      d="M48 78 A30 30 0 0 1 18 48"
    />
    <path
      fill="none"
      stroke="#FFFFFF"
      stroke-width="3.5"
      stroke-linecap="round"
      d="M18 48 A30 30 0 0 1 48 18"
    />
    <circle cx="32" cy="32" r="2.2"/>
    <circle cx="64" cy="32" r="2.2"/>
    <circle cx="64" cy="64" r="2.2"/>
    <circle cx="32" cy="64" r="2.2"/>
    <path
      mask="url(#houseMask)"
      d="M48 28 L68 44 V66 H28 V44 Z"
    />
    <path d="M48 24 L72 44 H24 Z"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(outPath, png);
console.log('Gerado:', outPath, `(${png.length} bytes)`);
