/**
 * Mensagem da casa — uma frase por dia civil (America/São_Paulo via Date local).
 * Índice estável no mesmo dia; muda à meia-noite local do dispositivo.
 */

const HOUSE_DAILY_MESSAGES = [
  'Organizar é abrir espaço para cuidar melhor de cada pessoa da corrente.',
  'Casa bem cuidada acolhe melhor — na agenda, na corrente e no coração.',
  'Cada nome na corrente merece atenção. Organização é também respeito.',
  'Pequenos cuidados diários sustentam o axé da casa.',
  'Quando a rotina está clara, sobra tempo para o que realmente importa.',
  'Avisar com carinho evita cobrança com pressa.',
  'A corrente caminha junta quando a casa se comunica com clareza.',
  'Registrar é lembrar. Lembrar é cuidar.',
  'Uma gira bem marcada já é metade do preparo.',
  'Mensalidade em dia é compromisso com a manutenção da casa.',
  'Quem cuida da casa, cuida de quem chega.',
  'Ordem no terreiro libera presença no atendimento.',
  'O axé também mora no detalhe: data, hora e quem confirma.',
  'Escutar a casa começa por olhar o que pede atenção hoje.',
  'Tradição se fortalece quando a memória não se perde.',
  'Cada pessoa ativada no app é um elo a mais na corrente.',
  'Cuidar do financeiro da casa é cuidar do espaço sagrado.',
  'Um aviso no momento certo evita três dúvidas depois.',
  'A casa respira melhor quando a agenda está viva.',
  'Presença começa antes da gira — no convite, no lembrete, no acolhimento.',
  'Organização não tira o mistério; ela protege o cuidado.',
  'Quem prepara com calma, acolhe com firmeza.',
  'A corrente se reconhece quando a casa se mostra presente.',
  'Hoje, um passo simples já move a casa pra frente.',
  'O que está escrito, a casa não esquece.',
  'Zelar é também acompanhar quem ainda não entrou no ritmo.',
  'Entre o preceito e a rotina, a constância é o elo.',
  'Uma casa organizada deixa o axé circular com leveza.',
  'Cuidar de poucos com atenção vale mais que correr atrás de tudo.',
  'A porta da casa abre melhor quando a comunicação está em paz.',
  'Toda corrente se fortalece quando ninguém fica para trás.',
] as const;

function dayOfYearLocal(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Mensagem do dia para o card “Mensagem da casa”. */
export function getHouseDailyMessage(date: Date = new Date()): string {
  const index = dayOfYearLocal(date) % HOUSE_DAILY_MESSAGES.length;
  return HOUSE_DAILY_MESSAGES[index] ?? HOUSE_DAILY_MESSAGES[0];
}
