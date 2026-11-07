import fs from "fs";

const envContent = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0 && !line.trim().startsWith("#")) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/\r/g, "");
  }
}

const token = env.WA_META_TOKEN;
const phoneId = env.WA_PHONE_NUMBER_ID;

async function sendTest() {
  const phone = "5511972638882"; // Milena
  const nome = "Milena";
  const terreiro = "Teste";
  const email = "milena20ferreira20@gmail.com";
  const registro = "AXC-2026-1E0F";
  
  const credencialText = `Login: seu E-mail (${email}), WhatsApp ou Registro (${registro}) · Senha: 6 primeiros dígitos do CPF · Link: https://axecloud.com.br/entrar?modo=filho`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: "conta_membro_cadastro_axc",
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: nome },
            { type: "text", text: terreiro },
            { type: "text", text: credencialText },
          ],
        },
      ],
    },
  };

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Meta response:", JSON.stringify(data, null, 2));
}

sendTest();
