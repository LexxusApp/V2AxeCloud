import * as fs from 'fs';

const MP = 'src/views/MasterPortal.tsx';
if (!fs.existsSync(MP)) {
  console.log('MasterPortal removido; skip fonts.ts');
  process.exit(0);
}

let code = fs.readFileSync(MP, 'utf8');

code = code.replace(/<h4 className="text-xl font-bold italic">Monitor de Atividade<\/h4>/g, '<h4 className="text-xl font-mono tracking-widest text-[#00E5FF]">NETWORK_MONITOR</h4>');
code = code.replace(/<h4 className="text-2xl font-black italic">Expansão de Rede<\/h4>/g, '<h4 className="text-2xl font-mono tracking-widest text-[#00E5FF]">DEPLOY_TERMINAL</h4>');
code = code.replace(/<h4 className="text-2xl font-black italic flex items-center gap-4">/g, '<h4 className="text-2xl font-mono tracking-widest flex items-center gap-4">');
code = code.replace(/<h4 className="text-xl font-bold italic">Auditoria & Segurança<\/h4>/g, '<h4 className="text-xl font-mono tracking-widest">SECURITY_AUDIT</h4>');

fs.writeFileSync(MP, code);
console.log('Fixed fonts.');
