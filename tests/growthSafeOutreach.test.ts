import assert from "node:assert/strict";
import test from "node:test";
import { buildGrowthIntro } from "../api/lib/growthOutreachMail.js";

test("convite seguro identifica a origem, oferece opt-out e deixa o contato iniciar o WhatsApp", () => {
  const intro = buildGrowthIntro({ terreiroNome: "Casa de Axé Esperança", cidade: "Suzano" });
  assert.match(intro.subject, /Casa de Axé Esperança/);
  assert.match(intro.message, /Meu nome é Lucas, sou de Suzano/i);
  assert.match(intro.message, /não tenho interesse/i);
  assert.match(intro.message, /wa\.me\/551152950746/);
  assert.match(intro.message, /30 dias/i);
});
