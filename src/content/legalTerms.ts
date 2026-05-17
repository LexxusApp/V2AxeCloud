export type LegalSection = { title: string; body: string };

export const LEGAL_CONTROLLER = 'AxéCloud — CNPJ 66.335.964/0001-07';

export const LEGAL_TERMS_TITLE = 'Termos de Uso e Política de Privacidade';

export const LEGAL_TERMS_SUMMARY =
  'O AxéCloud é uma plataforma SaaS para gestão de terreiros de Umbanda e Candomblé. Ao continuar, você declara ter lido e concordado com os termos abaixo.';

export const TERMS_OF_USE_TITLE = 'Termos de Uso';

export const TERMS_OF_USE_SUMMARY =
  'Regras de utilização da plataforma AxéCloud para zeladores e integrantes de terreiros de Umbanda e Candomblé.';

export const PRIVACY_POLICY_TITLE = 'Política de Privacidade';

export const PRIVACY_POLICY_SUMMARY =
  'Como o AxéCloud coleta, usa, armazena e protege os dados pessoais tratados na plataforma, em conformidade com a LGPD.';

export const LEGAL_TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Objeto do serviço',
    body:
      'O AxéCloud oferece ferramentas digitais para o zelador(a) administrar o terreiro: cadastro de filhos de santo, calendário, mural, financeiro, biblioteca, galeria e demais módulos conforme o plano contratado. O uso deve respeitar a legislação brasileira e a finalidade religiosa e comunitária do terreiro.',
  },
  {
    title: '2. Dados que tratamos',
    body:
      'Podemos armazenar dados de cadastro (nome, e-mail, WhatsApp), informações do terreiro, registros de filhos de santo, eventos, movimentações financeiras, arquivos enviados por você (fotos, documentos) e registros técnicos de acesso para segurança e suporte. Você é responsável pela veracidade das informações inseridas e pelo consentimento dos integrantes quando aplicável.',
  },
  {
    title: '3. Segurança e armazenamento',
    body:
      'Seus dados são armazenados de forma segura em infraestrutura em nuvem, com controles de acesso, criptografia em trânsito (HTTPS) e isolamento por terreiro (multi-tenant). Adotamos medidas razoáveis de proteção, sem garantir segurança absoluta contra todos os riscos da internet.',
  },
  {
    title: '4. Seu controle e exclusão',
    body:
      'Você tem controle total sobre os dados do seu terreiro. Pode corrigir informações nas configurações e, quando desejar encerrar o uso, solicitar a exclusão permanente da conta nas Configurações — o que remove os dados do terreiro conforme nossa rotina de exclusão (banco, arquivos e contas vinculadas de filhos com login, quando existirem).',
  },
  {
    title: '5. Compartilhamento',
    body:
      'Não vendemos seus dados. Compartilhamos apenas com provedores essenciais ao funcionamento do serviço (hospedagem, banco de dados, armazenamento de arquivos, mensagens WhatsApp quando você ativar a integração) e quando exigido por lei.',
  },
  {
    title: '6. Responsabilidades',
    body:
      'O AxéCloud é disponibilizado “como está”. Você mantém a confidencialidade das credenciais de acesso. Podemos suspender contas em caso de uso abusivo, fraude ou violação destes termos. Planos pagos seguem as condições informadas na contratação.',
  },
  {
    title: '7. Contato',
    body:
      `Dúvidas sobre privacidade ou estes termos: entre em contato pelo canal de suporte informado no aplicativo. Controlador: ${LEGAL_CONTROLLER}.`,
  },
];

/** Páginas públicas /termos — texto alinhado ao aceite no painel. */
export const TERMS_OF_USE_SECTIONS: LegalSection[] = [
  LEGAL_TERMS_SECTIONS[0],
  LEGAL_TERMS_SECTIONS[5],
  {
    title: '3. Alterações e vigência',
    body:
      'Podemos atualizar estes Termos de Uso para refletir mudanças legais ou no serviço. A versão vigente é indicada no rodapé desta página. O uso continuado após alterações constitui aceite, salvo quando a lei exigir novo consentimento.',
  },
  {
    title: '4. Lei aplicável',
    body:
      'Estes termos são regidos pelas leis da República Federativa do Brasil. Foro: comarca do domicílio do consumidor, quando aplicável o Código de Defesa do Consumidor.',
  },
  LEGAL_TERMS_SECTIONS[6],
];

/** Páginas públicas /privacidade — texto alinhado ao aceite no painel. */
export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  LEGAL_TERMS_SECTIONS[1],
  LEGAL_TERMS_SECTIONS[2],
  LEGAL_TERMS_SECTIONS[3],
  LEGAL_TERMS_SECTIONS[4],
  {
    title: '5. Base legal e direitos (LGPD)',
    body:
      'Tratamos dados com base em execução de contrato, legítimo interesse (segurança e melhoria do serviço) e consentimento quando necessário. Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade ou eliminação pelos canais de suporte, observadas obrigações legais de retenção.',
  },
  LEGAL_TERMS_SECTIONS[6],
];
