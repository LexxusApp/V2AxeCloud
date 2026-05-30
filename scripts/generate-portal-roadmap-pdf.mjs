/**
 * Gera PDF do roadmap AxéCloud → Portal do Axé
 * Uso: node scripts/generate-portal-roadmap-pdf.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs');
const outFile = path.join(outDir, 'AxeCloud-Roadmap-Portal-2026.pdf');

const FONT_REG = 'C:\\Windows\\Fonts\\arial.ttf';
const FONT_BOLD = 'C:\\Windows\\Fonts\\arialbd.ttf';

function ensureFonts() {
  if (!fs.existsSync(FONT_REG)) {
    throw new Error(`Fonte não encontrada: ${FONT_REG}`);
  }
}

function hr(doc, yGap = 14) {
  doc.moveDown(yGap / 14);
  const y = doc.y;
  doc
    .strokeColor('#C9A227')
    .lineWidth(0.8)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
  doc.moveDown(0.8);
}

function heading(doc, text, level = 1) {
  const sizes = { 1: 20, 2: 15, 3: 12 };
  doc
    .font('Bold')
    .fontSize(sizes[level] || 12)
    .fillColor(level === 1 ? '#1A1A1A' : '#2D2D2D')
    .text(text, { continued: false });
  doc.moveDown(level === 1 ? 0.6 : 0.4);
}

function paragraph(doc, text, opts = {}) {
  doc
    .font('Regular')
    .fontSize(opts.size || 10.5)
    .fillColor(opts.color || '#333333')
    .text(text, { align: opts.align || 'justify', lineGap: 3 });
  doc.moveDown(opts.gap ?? 0.5);
}

function bullet(doc, text) {
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.circle(x + 4, y + 5, 2).fill('#C9A227');
  doc
    .font('Regular')
    .fontSize(10.5)
    .fillColor('#333333')
    .text(text, x + 14, y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 14,
      align: 'justify',
      lineGap: 2,
    });
  doc.moveDown(0.35);
}

function table(doc, headers, rows) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = width / headers.length;
  let y = doc.y;

  if (y > doc.page.height - 80) doc.addPage();

  doc.font('Bold').fontSize(9).fillColor('#FFFFFF');
  headers.forEach((h, i) => {
    doc
      .rect(left + i * colW, y, colW, 22)
      .fill('#1A1A1A');
    doc.fillColor('#FFFFFF').text(h, left + i * colW + 6, y + 6, { width: colW - 10 });
  });
  y += 22;

  rows.forEach((row, ri) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    const bg = ri % 2 === 0 ? '#F7F5EF' : '#FFFFFF';
    row.forEach((cell, i) => {
      doc.rect(left + i * colW, y, colW, 20).fill(bg);
      doc
        .font('Regular')
        .fontSize(8.5)
        .fillColor('#333333')
        .text(String(cell), left + i * colW + 6, y + 5, { width: colW - 10 });
    });
    y += 20;
  });
  doc.y = y + 8;
}

function coverPage(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0F0F0F');
  doc
    .font('Bold')
    .fontSize(34)
    .fillColor('#C9A227')
    .text('AxéCloud', 60, 120);
  doc
    .font('Bold')
    .fontSize(22)
    .fillColor('#FFFFFF')
    .text('Roadmap Estratégico', 60, 168);
  doc
    .font('Regular')
    .fontSize(16)
    .fillColor('#CCCCCC')
    .text('De SaaS para Portal de Referência\nUmbanda · Candomblé · Brasil', 60, 210, { lineGap: 6 });

  doc
    .font('Regular')
    .fontSize(11)
    .fillColor('#888888')
    .text('Documento para implementação gradual e apresentação do projeto', 60, 320);

  doc
    .font('Regular')
    .fontSize(10)
    .fillColor('#666666')
    .text(`Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 60, doc.page.height - 80);
  doc.text('axecloud.com.br', 60, doc.page.height - 62);
}

function footer(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (i === 0) continue;
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor('#999999')
      .text(
        `AxéCloud — Roadmap Portal · Página ${i} de ${range.count - 1}`,
        doc.page.margins.left,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
      );
  }
}

function buildContent(doc) {
  doc.addPage();
  doc.fillColor('#333333');

  heading(doc, '1. Resumo executivo', 1);
  paragraph(
    doc,
    'Este documento descreve a evolução do AxéCloud de um software de gestão para terreiros em um portal de referência no Brasil para o nicho de Umbanda e Candomblé. O nicho tem pouca presença digital qualificada — oportunidade rara de construir autoridade com respeito cultural e utilidade real.',
  );
  paragraph(
    doc,
    'A estratégia recomendada é operar em duas camadas: Portal Público (audiência, SEO, confiança) + AxéCloud SaaS (ferramenta paga para zeladores e diretorias). O portal alimenta o SaaS; o SaaS gera dados para o portal (perfis, eventos, conteúdo).',
  );

  hr(doc);
  heading(doc, '2. Situação atual do AxéCloud', 1);
  bullet(doc, 'Produto: SaaS multi-tenant com financeiro, almoxarifado, calendário, mural, biblioteca, galeria e WhatsApp.');
  bullet(doc, 'Marketing: landing com SEO, FAQ e JSON-LD em axecloud.com.br.');
  bullet(doc, 'Gap do portal: sem diretório público, perfis de terreiro, agenda pública ou conteúdo editorial.');
  bullet(doc, 'Situação comercial: sem terreiros cadastrados ativos; mensalidade atual R$ 89,90 (plano Médio).');

  hr(doc);
  heading(doc, '3. Visão e posicionamento (18 meses)', 1);
  paragraph(
    doc,
    'Visão: ser o lugar onde o Brasil encontra, entende e se conecta com a tradição afro-brasileira — com respeito, utilidade e presença real nas casas.',
  );

  heading(doc, 'Flywheel estratégico', 2);
  bullet(doc, 'Terreiro usa AxéCloud → perfil público automático → aparece no diretório.');
  bullet(doc, 'Eventos públicos → tráfego orgânico e compartilhamento no WhatsApp.');
  bullet(doc, 'Mais visitantes → mais casas querem estar → mais conteúdo → mais autoridade.');

  hr(doc);
  heading(doc, '4. Estratégia de precificação', 1);
  paragraph(
    doc,
    'Pergunta central: com zero terreiros cadastrados, devo remover a cobrança para atrair casas e cobrar depois, ou manter R$ 89,90?',
  );

  heading(doc, 'Recomendação: não tire a cobrança — mude o modelo de entrada', 2);
  bullet(doc, 'O problema hoje não é o preço (R$ 89,90 é razoável para gestão completa), e sim a ausência de prova social, confiança e casos reais.');
  bullet(doc, 'Grátis para sempre atrai curiosos sem compromisso e dificulta cobrar depois (“por que agora pago?”).');
  bullet(doc, 'Cobrar desde o dia 1 sem nenhum terreiro usando gera atrito desnecessário na fase zero.');

  heading(doc, 'Modelo sugerido: Programa Fundador', 2);
  bullet(doc, 'Oferta clara na landing: “Programa Fundador — gratuito por 6 a 12 meses para as primeiras 20 casas”.');
  bullet(doc, 'Preço futuro visível: “Depois do período fundador: a partir de R$ 89,90/mês”. Transparência gera confiança.');
  bullet(doc, 'Limite de vagas: escassez real (“restam X vagas”) cria urgência sem desvalorizar o produto.');
  bullet(doc, 'Compromisso mútuo: a casa ganha uso gratuito; você ganha feedback, depoimento e permissão para perfil público.');
  bullet(doc, 'Plano gratuito permanente (freemium) só se limitado: ex. até 15 filhos, sem WhatsApp automático — evita canibalizar o Médio.');

  heading(doc, 'O que NÃO fazer', 2);
  bullet(doc, 'Não esconder que haverá cobrança no futuro.');
  bullet(doc, 'Não baixar preço agressivamente antes de validar valor.');
  bullet(doc, 'Não construir portal grande antes de ter 3–5 casas reais usando o sistema.');

  hr(doc);
  heading(doc, '5. O que fazer HOJE (passo imediato)', 1);
  paragraph(doc, 'Prioridade: validação com casas reais antes de escala técnica do portal.', { gap: 0.3 });

  heading(doc, 'Esta semana (ordem prática)', 2);
  bullet(doc, '1. Criar “Programa Fundador” na landing: formulário simples (nome da casa, cidade, WhatsApp, tradição).');
  bullet(doc, '2. Contato direto com 10 terreiros (WhatsApp/Instagram): convite pessoal, não esperar cadastro orgânico.');
  bullet(doc, '3. Onboarding manual das 3 primeiras casas — você configura junto, grava feedback.');
  bullet(doc, '4. Pedir depoimento + autorização de perfil público futuro (mesmo que a página venha depois).');
  bullet(doc, '5. Escolher 1 cidade piloto (ex.: São Paulo ou sua região) antes de pensar em cobertura nacional.');

  heading(doc, 'No portal (mínimo viável, sem rebuild grande)', 2);
  bullet(doc, 'Seção “Encontre casas de axé” com placeholder honesto: “Em construção — casas fundadoras em breve”.');
  bullet(doc, 'Página /programa-fundador com benefícios, prazo gratuito e formulário.');
  bullet(doc, '1 artigo publicado: “Como o AxéCloud ajuda terreiros a se organizar” + glossário de 10 termos (SEO inicial).');

  hr(doc);
  heading(doc, '6. Roadmap por trimestres', 1);

  const quarters = [
    {
      title: 'T1 (Meses 1–3) — Fundação do portal',
      goal: 'Presença pública indexável; deixar de ser só software.',
      items: [
        'Rotas públicas: /terreiros, /eventos, /conteudo separadas do app logado.',
        'Perfil público do terreiro (opt-in): nome, cidade, tradição, contato.',
        'Diretório v1 com 20–30 casas âncora.',
        'Sitemap dinâmico + SEO por página.',
        'Glossário (20 termos) + 5 artigos pilares com revisão cultural.',
      ],
      metrics: '30 perfis · 1.000 visitas orgânicas/mês · 10 conversões via perfil',
    },
    {
      title: 'T2 (Meses 4–6) — Eventos e descoberta local',
      goal: 'Utilidade imediata: “o que tem perto de mim esta semana”.',
      items: [
        'Agenda pública (eventos do calendário com flag “público”).',
        'Compartilhamento WhatsApp de eventos.',
        'Páginas por cidade (/terreiros/sao-paulo-sp).',
        'Mapa com privacidade (bairro/cidade, endereço opt-in).',
        'Newsletter “Agenda da semana no axé”.',
      ],
      metrics: '100 eventos · 5.000 visitas/mês · 80 terreiros no diretório',
    },
    {
      title: 'T3 (Meses 7–9) — Confiança e comunidade',
      goal: 'Credibilidade no meio; diferenciação de sites genéricos.',
      items: [
        'Selo “Casa verificada AxéCloud”.',
        'Perfis de lideranças (opt-in explícito).',
        'Canal de denúncia e moderação.',
        'Biblioteca e galeria pública (subset opt-in).',
      ],
      metrics: '50 casas verificadas · 10.000 visitas/mês · NPS ≥ 40',
    },
    {
      title: 'T4 (Meses 10–12) — Conteúdo que ranqueia',
      goal: 'Dominar buscas pouco atendidas em português.',
      items: [
        'Hub /conteudo com 50+ artigos.',
        'Calendário litúrgico/cultural (festas de santo).',
        'Trilhas “Guia do filho de santo”.',
        'Parcerias com federações e centros de estudo.',
      ],
      metrics: '30.000 visitas/mês · Top 10 em 20 keywords · 200 terreiros',
    },
    {
      title: 'T5 (Meses 13–15) — Ecossistema',
      goal: 'Infraestrutura do nicho, não só mais um site.',
      items: [
        'Widget embedável (agenda + perfil no site da casa).',
        'API pública read-only.',
        'PWA com notificações de eventos regionais.',
        'Relatórios “quantos viram seu perfil”.',
      ],
      metrics: '50.000 visitas/mês · 400 terreiros · 20 parceiros API/widget',
    },
    {
      title: 'T6 (Meses 16–18) — Escala e referência',
      goal: 'Portal mais acessado do nicho no Brasil.',
      items: [
        'Mapa vivo da tradição (dados agregados).',
        'Prêmio/selo anual de casas parceiras.',
        'Expansão regional (voluntários por macro-região).',
        'Monetização portal leve (destaque opcional, patrocínio editorial).',
      ],
      metrics: '100.000+ visitas/mês · 1.000 terreiros · referência em mídia',
    },
  ];

  quarters.forEach((q) => {
    if (doc.y > doc.page.height - 180) doc.addPage();
    heading(doc, q.title, 2);
    paragraph(doc, `Objetivo: ${q.goal}`, { size: 10 });
    q.items.forEach((item) => bullet(doc, item));
    paragraph(doc, `Métricas: ${q.metrics}`, { size: 9.5, color: '#555555' });
    doc.moveDown(0.4);
  });

  if (doc.y > doc.page.height - 200) doc.addPage();
  hr(doc);
  heading(doc, '7. Priorização (recursos limitados)', 1);
  table(
    doc,
    ['Ordem', 'Entrega', 'Motivo'],
    [
      ['1', 'Programa Fundador + 10 contatos', 'Validação antes de escala'],
      ['2', 'Perfil público + toggle no painel', 'Reaproveita dados existentes'],
      ['3', 'Diretório com casas âncora', 'Legitimidade'],
      ['4', 'Eventos públicos do calendário', 'Utilidade + WhatsApp'],
      ['5', 'Artigos + glossário', 'SEO baixo custo'],
      ['6', 'Páginas por cidade', 'Tráfego local recorrente'],
    ],
  );

  hr(doc);
  heading(doc, '8. KPIs por fase', 1);
  table(
    doc,
    ['Fase', 'Visitas org./mês', 'Terreiros', 'Eventos públicos'],
    [
      ['T1', '1.000', '30', '—'],
      ['T2', '5.000', '80', '100'],
      ['T3', '10.000', '150', '300'],
      ['T4', '30.000', '200', '800'],
      ['T5', '50.000', '400', '1.500'],
      ['T6', '100.000+', '1.000', '3.000+'],
    ],
  );

  hr(doc);
  heading(doc, '9. Riscos e mitigações', 1);
  table(
    doc,
    ['Risco', 'Mitigação'],
    [
      ['Conteúdo culturalmente incorreto', 'Revisão por praticantes; comitê consultivo'],
      ['Privacidade das casas', 'Opt-in explícito; endereço parcial'],
      ['Baixa adesão', 'Programa fundador; onboarding manual'],
      ['Sobrecarga da equipe', 'Automatizar perfil a partir do SaaS'],
      ['Cobrar tarde demais', 'Prazo fundador claro desde o cadastro'],
    ],
  );

  hr(doc);
  heading(doc, '10. Checklist de apresentação do projeto', 1);
  paragraph(doc, 'Use este documento para apresentar a investidores, parceiros ou lideranças religiosas:', { gap: 0.3 });
  bullet(doc, 'Problema: nicho sem referência digital confiável no Brasil.');
  bullet(doc, 'Solução: portal + SaaS integrados, com respeito à diversidade de linhas.');
  bullet(doc, 'Diferencial: produto já funcional + flywheel terreiro → tráfego → mais terreiros.');
  bullet(doc, 'Fase atual: validação com Programa Fundador (20 casas).');
  bullet(doc, 'Pedido: parceria, indicação de casas, revisão de conteúdo — não necessariamente dinheiro.');
  bullet(doc, 'Próximos 90 dias: 20 perfis, 5 artigos, agenda pública piloto em 1 cidade.');

  doc.moveDown(1);
  paragraph(
    doc,
    'Axé ao seu projeto. Implemente aos poucos, valide com casas reais, e escale o portal sobre base sólida de confiança.',
    { align: 'center', color: '#C9A227', size: 11 },
  );
}

function main() {
  ensureFonts();
  fs.mkdirSync(outDir, { recursive: true });

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    bufferPages: true,
    info: {
      Title: 'AxéCloud — Roadmap Portal 2026',
      Author: 'AxéCloud',
      Subject: 'Estratégia de evolução para portal Umbanda e Candomblé',
    },
  });

  const stream = fs.createWriteStream(outFile);
  doc.pipe(stream);

  doc.registerFont('Regular', FONT_REG);
  doc.registerFont('Bold', FONT_BOLD);

  coverPage(doc);
  buildContent(doc);
  footer(doc);

  doc.end();

  stream.on('finish', () => {
    console.log(`PDF gerado: ${outFile}`);
  });
}

main();
