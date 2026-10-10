import assert from "node:assert/strict";
import test from "node:test";
import { buildMetaTemplateComponentsForTipo } from "../api/lib/whatsappMetaCloud";

test("aviso de comunicado envia os 3 parâmetros do template da Meta", () => {
  const components = buildMetaTemplateComponentsForTipo(
    "transmissao_aviso",
    "Milnea",
    "teste",
    {
      nome_filho: "Milnea",
      nome_terreiro: "teste",
      titulo_aviso: "Gira de Oxum",
      conteudo_aviso: "Hoje às 20h",
    }
  );
  const body = components.find((component) => component.type === "body");
  const texts = (body?.parameters || []).map((param) => ("text" in param ? param.text : ""));
  assert.deepEqual(texts, ["Milnea", "teste"]);
});
