import fs from 'node:fs';

const configPath = 'wrangler.app-production.jsonc';
let content = fs.readFileSync(configPath, 'utf8');

if (!content.includes('login-bg-trident.png')) {
  const target = '{ "pattern": "axecloud.com.br/login-bg-desktop.png*", "zone_name": "axecloud.com.br" },';
  const addition = `    { "pattern": "axecloud.com.br/login-bg-trident.png*", "zone_name": "axecloud.com.br" },\r\n    { "pattern": "axecloud.com.br/login-preview.html*", "zone_name": "axecloud.com.br" },`;
  
  content = content.replace(target, `${target}\r\n${addition}`);
  fs.writeFileSync(configPath, content, 'utf8');
  console.log('wrangler.app-production.jsonc updated successfully!');
} else {
  console.log('Already present.');
}
