import { randomInt } from "node:crypto";

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*-_";
const ALL = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

function pick(alphabet: string): string {
  return alphabet[randomInt(0, alphabet.length)];
}

/** Gera uma senha temporária forte, sem caracteres visualmente ambíguos. */
export function generateSecureAccessPassword(length = 16): string {
  const size = Math.max(12, Math.min(64, Math.floor(length)));
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALL));

  // Fisher-Yates com CSPRNG; evita que as quatro classes fiquem em posições fixas.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
