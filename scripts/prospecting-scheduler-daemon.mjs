import { runProspectingBatch } from './run-commercial-prospecting.mjs';

const CHECK_INTERVAL_MS = 60 * 1000; // verifica a cada 1 minuto

console.log('====================================================');
console.log('DAEMON DE PROSPECÇÃO COMERCIAL AXÉCLOUD INICIADO');
console.log('Janela ativa: 09:00 às 18:00 (America/Sao_Paulo)');
console.log('Limite diário: 25 leads qualificados');
console.log('Fora da janela: 100% receptivo (apenas responde)');
console.log('====================================================\n');

async function loop() {
  while (true) {
    try {
      const now = new Date();
      const spString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const spDate = new Date(spString);
      const hour = spDate.getHours();
      const minute = spDate.getMinutes();

      // Se for exatamente entre 09:00 e 18:00
      if (hour >= 9 && hour < 18) {
        console.log(`[${spDate.toLocaleTimeString('pt-BR')}] Dentro da janela comercial. Verificando lote diário...`);
        const result = await runProspectingBatch({ limit: 25 });
        if (result.status === 'completed' || result.status === 'daily_limit_reached') {
          // Se já completou ou bateu a cota do dia, aguarda 1 hora antes de checar novamente
          console.log(`[${spDate.toLocaleTimeString('pt-BR')}] Cota do dia verificada. Dormindo por 60 minutos...`);
          await new Promise(r => setTimeout(r, 60 * 60 * 1000));
          continue;
        }
      }
    } catch (err) {
      console.error('[DAEMON ERROR]:', err);
    }
    // Aguarda 1 minuto até a próxima verificação
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

loop();
