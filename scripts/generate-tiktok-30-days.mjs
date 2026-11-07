import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('docs/marketing/tiktok');
const backgroundsDir = path.join(root, 'backgrounds');
const outputDir = path.join(root, '30-dias-assets');
fs.mkdirSync(outputDir, { recursive: true });

const posts = [
  ['TERREIRO NÃO É PLANILHA.', 'É comunidade, cuidado e presença.', 'Conheça o AxéCloud'],
  ['PROCURANDO UMA CASA DE AXÉ?', 'Encontre terreiros perto de você.', 'Veja o mapa gratuito'],
  ['PRIMEIRA VEZ EM UM TERREIRO?', 'Confirme horário, regras e atividade aberta.', 'Salve antes de visitar'],
  ['A CASA QUE VOCÊ PROCURA', 'pode estar no seu próprio bairro.', 'Use o mapa do AxéCloud'],
  ['UMBANDA E CANDOMBLÉ', 'não são iguais — e cada casa tem seus fundamentos.', 'Respeito começa por ouvir'],
  ['QUAL É O DIA DA GIRA?', 'Horário claro também é acolhimento.', 'Informe no perfil da casa'],
  ['NINGUÉM VÊ A BUROCRACIA', 'que acontece antes de cada gira.', 'Organização devolve tempo'],
  ['DE QUAL CIDADE VOCÊ É?', 'Estamos mapeando casas em todo o Brasil.', 'Comente sua cidade'],
  ['PERFIL COMPLETO GERA CONFIANÇA', 'Endereço, fotos, contato e horários.', 'Facilite a primeira visita'],
  ['3 CUIDADOS NA PRIMEIRA VISITA', 'Confirme. Respeite. Escute.', 'Compartilhe com quem precisa'],
  ['AVISO NÃO PRECISA VIRAR CORRERIA', 'Centralize a comunicação da casa.', 'Menos ruído. Mais clareza.'],
  ['O QUE FAZ VOCÊ SE SENTIR ACOLHIDO?', 'Informação clara também recebe bem.', 'Conte nos comentários'],
  ['DADOS DA CASA MERECEM CUIDADO', 'Privacidade também faz parte da gestão.', 'Organize com responsabilidade'],
  ['CADA PONTO NO MAPA', 'representa uma comunidade e uma história.', 'Encontre uma casa perto'],
  ['CONHECE UM TERREIRO SÉRIO?', 'Ajude essa casa a ser encontrada.', 'Marque ou compartilhe'],
  ['AGENDA ORGANIZADA', 'menos perguntas repetidas e menos desencontro.', 'Giras e eventos em um lugar'],
  ['A MEMÓRIA DA CASA', 'não pode depender de um único celular.', 'Preserve fotos e documentos'],
  ['UM CONSELHO PARA QUEM COMEÇA', 'Qual orientação você daria?', 'Responda nos comentários'],
  ['SUA CASA CONTA A PRÓPRIA HISTÓRIA?', 'Biografia, fotos e contatos no perfil público.', 'Mostre quem vocês são'],
  ['FINANCEIRO SEM CONFUSÃO', 'Mensalidades e despesas com clareza.', 'Decida com segurança'],
  ['TRADIÇÃO E TECNOLOGIA', 'podem caminhar juntas com respeito.', 'Tecnologia cuida do repetitivo'],
  ['O QUE FALTA EM UM PERFIL?', 'Telefone, fotos, horários ou endereço?', 'Sua resposta melhora o mapa'],
  ['RADAR DO TERREIRO', 'Veja sua casa no mapa e acompanhe visualizações.', 'Visibilidade com controle'],
  ['COMO VOCÊ ENCONTROU SUA CASA?', 'Indicação, internet ou um encontro inesperado?', 'Conte sua história'],
  ['ENDEREÇO ERRADO FRUSTRA', 'Confirme a localização antes de publicar.', 'Mini mapa para conferir'],
  ['POR QUE O AXÉCLOUD EXISTE?', 'Menos burocracia. Mais tempo para cuidar da casa.', 'Feito para terreiros'],
  ['COMECE PELO QUE MAIS PESA', 'Agenda, financeiro, avisos ou documentos.', 'Um passo de cada vez'],
  ['30 DIAS PARA TESTAR', 'Sem cartão e sem cobrança automática.', 'Conheça antes de decidir'],
  ['INFORMAÇÃO ABRE CAMINHOS', 'Ajude alguém a encontrar uma casa de axé.', 'Compartilhe este perfil'],
  ['O QUE VOCÊ QUER VER AQUI?', 'Gestão, tradição, mapa ou primeira visita?', 'Escolha nos comentários'],
];

const bgNames = ['gestao-pessoa.png', 'mapa-celular.png', 'painel.png', 'agenda.png', 'memoria.png', 'seguranca.png'];
const backgrounds = bgNames.map((name) => path.join(backgroundsDir, name));
const colors = ['#F6C433', '#F5EBDD', '#EFBD3D', '#FFF7E8'];

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

function wrap(text, max = 20) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > max && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock(lines, x, y, size, lineHeight, fill, weight = 800) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Manrope, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="-1.5">${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}</text>`;
}

for (let index = 0; index < posts.length; index += 1) {
  const [headline, subline, cta] = posts[index];
  const n = String(index + 1).padStart(2, '0');
  const background = backgrounds[index % backgrounds.length];
  // Keep headline lines short enough for TikTok's narrow mobile safe area.
  const headlineLines = wrap(headline, 15);
  const sublineLines = wrap(subline, 34);
  const accent = colors[index % colors.length];
  const topLayout = index % 2 === 0;
  const panelY = topLayout ? 120 : 920;
  const panelH = topLayout ? 760 : 790;
  const headlineY = panelY + 165;
  const sublineY = headlineY + headlineLines.length * 112 + 62;
  const ctaY = panelY + panelH - 125;
  const svg = `
    <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#061A12" stop-opacity="${topLayout ? 0.94 : 0.28}"/>
          <stop offset="0.5" stop-color="#061A12" stop-opacity="0.20"/>
          <stop offset="1" stop-color="#061A12" stop-opacity="${topLayout ? 0.45 : 0.96}"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#shade)"/>
      <rect x="56" y="${panelY}" width="968" height="${panelH}" rx="42" fill="#071B13" fill-opacity="0.88" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
      <rect x="96" y="${panelY + 56}" width="72" height="8" rx="4" fill="${accent}"/>
      <text x="190" y="${panelY + 70}" fill="#F7F0E4" font-family="Manrope, Arial, sans-serif" font-size="27" font-weight="700" letter-spacing="4">AXÉCLOUD</text>
      ${textBlock(headlineLines, 96, headlineY, 83, 105, accent, 850)}
      ${textBlock(sublineLines, 98, sublineY, 39, 52, '#FFF8EC', 560)}
      <rect x="96" y="${ctaY - 58}" width="${Math.min(820, 170 + cta.length * 18)}" height="92" rx="46" fill="${accent}"/>
      <text x="132" y="${ctaY}" fill="#092016" font-family="Manrope, Arial, sans-serif" font-size="31" font-weight="800">${escapeXml(cta)}  →</text>
      <text x="96" y="${panelY + panelH - 45}" fill="#F7F0E4" fill-opacity="0.68" font-family="Manrope, Arial, sans-serif" font-size="24">@axecloudoficial</text>
    </svg>`;

  await sharp(background)
    .resize(1080, 1920, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(path.join(outputDir, `post-${n}-tiktok.jpg`));
}

console.log(`Geradas ${posts.length} artes em ${outputDir}`);
