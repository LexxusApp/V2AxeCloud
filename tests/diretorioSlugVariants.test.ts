import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDiretorioSlugVariants, slugifyTerreiroNome } from "../api/lib/diretorioSlug.js";

describe("diretorioSlug variants resolution", () => {
  it("extrai variantes corretas para URLs com hífen duplo legado", () => {
    const raw = "associacao-cultural-e-religiosa-oyekundi-iretekutan--14fcea29";
    const variants = parseDiretorioSlugVariants(raw);

    assert.ok(variants.includes("associacao-cultural-e-religiosa-oyekundi-iretekutan-14fcea29"));
    assert.ok(variants.includes("associacao-cultural-e-religiosa-oyekundi-iretekutan--14fcea29"));
    assert.strictEqual(variants.length, 2);
  });

  it("produz apenas uma variante quando o slug já é limpo", () => {
    const clean = "terreiro-pedreira-de-xango-e-mane-do-sabia";
    const variants = parseDiretorioSlugVariants(clean);

    assert.deepStrictEqual(variants, ["terreiro-pedreira-de-xango-e-mane-do-sabia"]);
  });

  it("ignora caracteres especiais ou tentativas de injection mantendo a variante normalizada e higienizada", () => {
    const weird = "terreiro-xango--abc!@#$$%--def";
    const variants = parseDiretorioSlugVariants(weird);

    // Deve ser array válido sem quebrar
    assert.ok(variants.length >= 1);
    for (const v of variants) {
      assert.match(v, /^[a-z0-9-]+$/);
    }
  });

  it("retorna vazio para strings nulas ou vazias", () => {
    assert.deepStrictEqual(parseDiretorioSlugVariants(""), []);
    assert.deepStrictEqual(parseDiretorioSlugVariants("   "), []);
    assert.deepStrictEqual(parseDiretorioSlugVariants("-"), []);
  });
});
