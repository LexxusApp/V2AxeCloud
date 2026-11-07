import fs from 'fs';

let content = fs.readFileSync('vite.config.ts', 'utf8');
const regex = /server:\s*\{[\s\S]*?\},?\s*\};\s*\}\);/;
console.log('Regex match:', regex.test(content));
if (regex.test(content)) {
  const replacement = `server: {
      host: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'https://axecloud.com.br',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      host: true,
      port: 4173,
      proxy: {
        '/api': {
          target: 'https://axecloud.com.br',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});`;
  content = content.replace(regex, replacement);
  fs.writeFileSync('vite.config.ts', content, 'utf8');
  console.log('Successfully updated vite.config.ts with proxy!');
}
