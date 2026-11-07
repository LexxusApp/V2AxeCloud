import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const destination = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/library');
fs.mkdirSync(destination, { recursive: true });
const examples = [
  ['caderno-de-cantigas', 'Caderno de cantigas', 'Cantigas', 'Um espaço para organizar títulos, referências e anotações de estudo. Este exemplo não contém letras de músicas.'],
  ['memoria-da-casa', 'Memória da casa', 'História', 'Um roteiro para registrar memórias e referências da comunidade. Nenhuma história de uma casa real está representada aqui.'],
  ['roteiro-de-estudos', 'Roteiro de estudos', 'Fundamentos', 'Um roteiro de organização de leitura. Não contém ensinamentos, prescrições ou fundamentos religiosos.'],
  ['leitura-individual', 'Leitura individual', 'Fundamentos', 'Exemplo de um material destinado a um único membro. Nenhuma informação pessoal ou orientação religiosa real foi incluída.'],
];
for (const [name, title, category, description] of examples) {
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(path.join(destination, `${name}.pdf`));
    const pdf = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `${title} — exemplo local`, Author: 'AxéCloud · Protótipo', Subject: 'Documento sintético para validar a Biblioteca local' } });
    pdf.pipe(stream); stream.on('finish', resolve); stream.on('error', reject);
    pdf.rect(0, 0, 595, 842).fill('#f5f1e6');
    pdf.fillColor('#244334').fontSize(14).text('AxéCloud · Biblioteca de Estudos', 56, 56);
    pdf.fontSize(34).text(title, 56, 170, { width: 450 });
    pdf.moveDown().fontSize(14).fillColor('#54684b').text(category);
    pdf.moveDown(2).fontSize(13).fillColor('#314a37').text(description, { width: 460, lineGap: 7 });
    pdf.moveDown(2).fontSize(11).text('Material de demonstração, criado para o protótipo local. Não é conteúdo oficial de um terreiro e não deve ser usado como orientação litúrgica.', { width: 460, lineGap: 5 });
    pdf.addPage();
    pdf.fillColor('#244334').fontSize(24).text('Espaço para o estudo');
    pdf.moveDown().fontSize(13).text('Esta segunda página permite testar navegação, zoom e leitura do PDF. Todo o conteúdo deste arquivo é demonstrativo.', { lineGap: 7 });
    pdf.moveDown(2).fontSize(16).text('Anotações e referências');
    pdf.moveDown().fontSize(12).text('O zelador poderá adicionar seu próprio material no fluxo da Biblioteca. Na prévia local, os arquivos escolhidos ficam apenas em memória; nada é enviado para o sistema atual.', { lineGap: 6 });
    pdf.end();
  });
  console.log(`${name}.pdf`);
}
