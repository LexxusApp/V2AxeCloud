#!/usr/bin/env python3
import json, urllib.request, urllib.error, time

env = {}
for line in open('.env', encoding='utf-8'):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

token = env['WA_META_TOKEN']
waba = env['WA_BUSINESS_ACCOUNT_ID']
ver = env.get('WA_BUSINESS_VERSION', 'v21.0')

def graph(method, path, body=None):
    url = f"https://graph.facebook.com/{ver}/{path}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f"Bearer {token}")
    if body is not None:
        req.add_header('Content-Type', 'application/json; charset=utf-8')
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='ignore')
        try:
            return e.code, json.loads(raw)
        except:
            return e.code, {'error': raw}

name = "aviso_acesso_filhos_zelador_axc"

TEMPLATE = {
    "name": name,
    "language": "pt_BR",
    "category": "MARKETING",
    "components": [
        {
            "type": "BODY",
            "text": (
                "Olá, {{1}}!\n\n"
                "Para facilitar o acesso dos médiuns de {{2}}, agora seus filhos de santo têm 3 opções para entrar no AxéCloud:\n\n"
                "🔐 Login: E-mail cadastrado, WhatsApp ou Registro da casa\n"
                "🔑 Senha: 6 primeiros dígitos do CPF\n"
                "📲 Link: https://axecloud.com.br/entrar?modo=filho\n\n"
                "💡 Dica: Para o médium entrar pelo e-mail pessoal, basta que o e-mail esteja preenchido na ficha dele no seu painel. Nos novos cadastros, o e-mail agora é solicitado na hora!\n\n"
                "Acesse seu painel pelo botão abaixo. Axé!"
            ),
            "example": {
                "body_text": [
                    [
                        "Mãe Miriam",
                        "Kwe Nago Vodun Omin Odolá",
                    ]
                ]
            },
        },
        {"type": "FOOTER", "text": "Mensagem automática do AxéCloud."},
        {
            "type": "BUTTONS",
            "buttons": [
                {
                    "type": "URL",
                    "text": "Acessar Painel",
                    "url": "https://axecloud.com.br/dashboard",
                }
            ],
        },
    ],
}

code, res = graph('POST', f"{waba}/message_templates", TEMPLATE)
print(f"POST code={code}:", json.dumps(res, indent=2))

time.sleep(3)
code, check = graph('GET', f"{waba}/message_templates?name={name}&fields=name,status,category,rejected_reason")
print(f"GET code={code}:", json.dumps(check, indent=2))
