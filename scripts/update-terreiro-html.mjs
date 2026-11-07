import fs from 'node:fs';

const path = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/cinematic-site/terreiro.html';
let content = fs.readFileSync(path, 'utf8');

const targetFunction = `      const registrarVisitaGoogle = (profileSlug) => {
        const origem = origemGoogle();
        if (!origem.google) return;
        const marker = \`axecloud_google_profile:\${new Date().toISOString().slice(0, 10)}:\${profileSlug}\`;
        if (sessionStorage.getItem(marker)) return;
        fetch(\`/api/v1/public/diretorio/terreiro/\${encodeURIComponent(profileSlug)}/google-view\`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ ...origem, visitorId: visitorId() }),
        }).then((response) => { if (response.ok) sessionStorage.setItem(marker, "1"); }).catch(() => undefined);
      };`;

const replacementFunction = `      const registrarVisita = (profileSlug) => {
        const origem = origemGoogle();
        const marker = \`axecloud_profile_view:\${new Date().toISOString().slice(0, 10)}:\${profileSlug}\`;
        if (sessionStorage.getItem(marker)) return;
        const endpoint = origem.google ? "google-view" : "profile-click";
        fetch(\`/api/v1/public/diretorio/terreiro/\${encodeURIComponent(profileSlug)}/\${endpoint}\`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ ...origem, visitorId: visitorId() }),
        }).then((response) => { if (response.ok) sessionStorage.setItem(marker, "1"); }).catch(() => undefined);
      };`;

if (content.includes(targetFunction)) {
  content = content.replace(targetFunction, replacementFunction);
  content = content.replace('registrarVisitaGoogle(', 'registrarVisita(');
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully updated cinematic-site/terreiro.html');
} else {
  console.log('Target function not found directly, trying normalized CRLF...');
  const normalized = content.replace(/\r\n/g, '\n');
  const targetNorm = targetFunction.replace(/\r\n/g, '\n');
  if (normalized.includes(targetNorm)) {
    const updated = normalized.replace(targetNorm, replacementFunction).replace('registrarVisitaGoogle(', 'registrarVisita(');
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully updated with normalized CRLF');
  } else {
    console.error('Failed to find target in cinematic-site/terreiro.html');
  }
}
