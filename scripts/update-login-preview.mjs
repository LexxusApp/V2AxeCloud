import fs from 'node:fs';

const filePath = 'c:/Users/Lucas A/Desktop/Axecloud-Dashboard-Local/login-preview.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. Remove video CSS
html = html.replace(/\/\* Cinematic Video Background[\s\S]*?\.bg-video-overlay[\s\S]*?pointer-events: none;\s*\}/, '/* Video background removed - using crystal-clear photo */');

// 2. Ensure border-beam-track is display: block by default
html = html.replace(/display:\s*none;\s*\/\*\s*Desativado por padr[^;]*?\*\//, 'display: block; /* Border Beam Ativo 60 FPS */');

// 3. Remove video html block and ensure photo background is present
html = html.replace(/<!-- Video Background[\s\S]*?<\/div>\s*<\/div>/, `<!-- Imagem de Fundo em Alta Resolucao Nativa (100% Qualidade) -->
  <div class="bg-photo-wrapper active" id="bgPhotoWrapper" aria-hidden="true">
    <img src="/login-bg-trident.png" class="bg-photo-img" alt="Altar Mistico do Tridente Dourado" />
    <div class="bg-photo-overlay"></div>
  </div>`);

// 4. Update preview bar to remove video buttons
const oldPreviewBar = /<div class="preview-bar">[\s\S]*?<\/div>\s*<div class="viewport-wrapper"/;
const newPreviewBar = `<div class="preview-bar">
    <span class="pill">AxéCloud</span>
    <button class="preview-btn active" id="btnDesktop" onclick="setMode('desktop')">🖥️ Desktop</button>
    <button class="preview-btn" id="btnMobile" onclick="setMode('mobile')">📱 Celular</button>
    
    <div class="divider"></div>
    <span style="color: #a1a1aa; font-size: 10px; font-weight: 700; text-transform: uppercase;">Posição:</span>
    <button class="preview-btn" id="btnPosSplit" onclick="setLayoutPos('split')">📐 Lateral (Ver Altar)</button>
    <button class="preview-btn active" id="btnPosCenter" onclick="setLayoutPos('center')">🎯 Centralizado</button>

    <div class="divider"></div>
    <span style="color: #fbbf24; font-size: 10px; font-weight: 700; text-transform: uppercase;">Efeito:</span>
    <span style="color: #34d399; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">✨ Border Beam 60 FPS</span>

    <div class="divider"></div>
    <button class="preview-btn" onclick="simulateSuccess()">🚀 Testar Login</button>
  </div>

  <div class="viewport-wrapper" id="viewport"`;

html = html.replace(oldPreviewBar, newPreviewBar);

// 5. Ensure border-beam-track has active class in HTML
html = html.replace('<div class="border-beam-track">', '<div class="border-beam-track active">');

// 6. Remove setVideoBg function from script
html = html.replace(/function setVideoBg\(num\)[\s\S]*?\}\s*function setBgSilhouette/, 'function setBgSilhouette');

fs.writeFileSync(filePath, html, 'utf8');

// Also copy to AxecloudV2/public/login-preview.html so it is accessible in production
fs.writeFileSync('C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/public/login-preview.html', html, 'utf8');

console.log('login-preview.html updated and copied to public/ successfully!');
