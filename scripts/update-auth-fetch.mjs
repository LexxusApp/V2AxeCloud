import fs from 'fs';

let content = fs.readFileSync('src/lib/authenticatedFetch.ts', 'utf8');
const search = 'res.clone().json().then((json) => {';
if (content.includes(search)) {
  const replacement = `const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          res.clone().json().then((json) => {
            const errMsg = json?.error || json?.message || \`HTTP \${res.status}\`;
            void reportFeatureFailureClient({
              feature: classifyFeatureFromUrl(urlStr),
              action: \`\${method} \${urlStr}\`.slice(0, 120),
              error: errMsg,
              httpStatus: res.status,
              metadata: { method, url: urlStr },
            });
          }).catch(() => {});
        }`;
  
  // replace from res.clone().json() to the catch block end
  const startIdx = content.indexOf('res.clone().json().then((json) => {');
  const endIdx = content.indexOf('});', content.indexOf('}).catch(() => {', startIdx)) + 3;
  content = content.slice(0, startIdx) + replacement + content.slice(endIdx);
  fs.writeFileSync('src/lib/authenticatedFetch.ts', content, 'utf8');
  console.log('Successfully updated authenticatedFetch.ts!');
} else {
  console.log('Search string not found in authenticatedFetch.ts');
}
