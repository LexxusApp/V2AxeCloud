import fs from 'fs';
import path from 'path';

const targetDir = 'C:\\Users\\Lucas A\\Desktop\\Axecloud-Landing-Local';

async function cloneLanding() {
  console.log(`Criando cópia local em: ${targetDir}`);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Baixar o HTML exato da home em produção
  console.log('Baixando HTML da landing page...');
  const res = await fetch('https://axecloud.com.br/');
  let html = await res.text();

  // 2. Criar subpasta assets
  const assetsDir = path.join(targetDir, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  // 3. Localizar e baixar os arquivos CSS referenciados
  const cssMatches = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)];
  for (const match of cssMatches) {
    const rawUrl = match[1];
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://axecloud.com.br${rawUrl}`;
    const filename = path.basename(rawUrl.split('?')[0]);
    console.log(`Baixando CSS: ${filename} de ${fullUrl}`);
    try {
      const cssRes = await fetch(fullUrl);
      if (cssRes.ok) {
        const cssContent = await cssRes.text();
        fs.writeFileSync(path.join(assetsDir, filename), cssContent, 'utf-8');
        // Substituir no HTML pelo caminho local relativo
        html = html.replaceAll(rawUrl, `./assets/${filename}`);
      }
    } catch (err) {
      console.warn(`Aviso ao baixar CSS ${rawUrl}:`, err.message);
    }
  }

  // 4. Copiar as imagens da pasta public do site-next para a pasta local
  const sourcePublic = path.resolve('site-next/public');
  if (fs.existsSync(sourcePublic)) {
    console.log('Copiando imagens e ícones...');
    fs.cpSync(sourcePublic, targetDir, { recursive: true });
  }

  // 5. Salvar o index.html pronto para abrir no navegador
  fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf-8');
  console.log('index.html salvo com sucesso.');

  // 6. Criar cópia do código fonte original para edições (page.tsx e cinematic.css)
  const srcBackupDir = path.join(targetDir, 'codigo-fonte');
  fs.mkdirSync(srcBackupDir, { recursive: true });
  fs.copyFileSync('site-next/app/page.tsx', path.join(srcBackupDir, 'page.tsx'));
  fs.copyFileSync('site-next/app/cinematic.css', path.join(srcBackupDir, 'cinematic.css'));

  // 7. Criar script bat para iniciar servidor local caso queira rodar via localhost
  const batContent = `@echo off
echo ========================================================
echo   INICIANDO PREVIEW LOCAL DA LANDING PAGE AXECLOUD
echo ========================================================
echo.
echo Abrindo em http://localhost:4000 ...
echo Pressione Ctrl + C para parar o servidor.
echo.
npx --yes serve . -l 4000
pause
`;
  fs.writeFileSync(path.join(targetDir, 'iniciar-preview.bat'), batContent, 'utf-8');

  // 8. Criar README explicativo
  const readmeContent = `# Cópia Local da Landing Page do AxéCloud

Esta é uma cópia completa da landing page feita exclusivamente para testes locais antes de subir qualquer alteração para o ar.

### Como visualizar:
1. **Opção 1 (Direto no Navegador):** Basta dar dois cliques no arquivo \`index.html\`.
2. **Opção 2 (Servidor Local com navegação completa):** Dê dois cliques em \`iniciar-preview.bat\` e abra \`http://localhost:4000\`.

### Onde estão os arquivos de estilo e conteúdo:
- \`index.html\` (HTML estático pronto para pré-visualização instantânea)
- \`assets/index-*.css\` (Estilos compilados em uso)
- \`codigo-fonte/page.tsx\` e \`codigo-fonte/cinematic.css\` (Código fonte original para aplicarmos as mudanças)
`;
  fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf-8');

  console.log('Cópia concluída com sucesso!');
}

cloneLanding().catch(console.error);
