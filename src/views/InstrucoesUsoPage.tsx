import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Flame,
  KeyRound,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ROUTES } from '../lib/routes';
import { cn } from '../lib/utils';

type Audience = 'zelador' | 'membro';

type GuideItem = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const ZELADOR_PATH: GuideItem[] = [
  {
    icon: Users,
    title: 'Cadastre a corrente',
    body: 'Nome, WhatsApp com DDD e CPF. Preferível o CPF completo (11 dígitos): os 6 primeiros são a senha de login; o completo libera o comprovante automático. Ao salvar, o registro pode sair pelo WhatsApp oficial da plataforma.',
  },
  {
    icon: KeyRound,
    title: 'Como o membro entra',
    body: 'axecloud.com.br/entrar → Membro → Registro (AXC-…) + 6 primeiros dígitos do CPF. Não é senha de e-mail nem do WhatsApp.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp sem QR Code',
    body: 'Os avisos saem pelo WhatsApp Business oficial do AxéCloud. Você não conecta o celular. Em Configurações → WhatsApp, ligue as automações e confira o número de cada pessoa.',
  },
  {
    icon: CalendarDays,
    title: 'Giras e agenda',
    body: 'Marque giras, convide convidados, acompanhe confirmações e avise a corrente pelo canal da plataforma.',
  },
  {
    icon: Wallet,
    title: 'Mensalidade e Pix',
    body: 'Configure chave Pix e valor, acompanhe pendências e confirme pagamentos. Com CPF completo no cadastro, o membro envia o comprovante sozinho.',
  },
  {
    icon: CircleHelp,
    title: 'Suporte',
    body: 'Se algo travar, use Suporte no painel. A equipe AxéCloud responde por lá.',
  },
];

const MEMBRO_STEPS: GuideItem[] = [
  {
    icon: Users,
    title: 'Escolha Membro',
    body: 'Em /entrar toque em Membro. A tela do Zelador é só para quem cuida da casa.',
  },
  {
    icon: KeyRound,
    title: 'Registro da casa',
    body: 'Use o código do WhatsApp (AXC-ANO-XXXX). Pode digitar sem hífen.',
  },
  {
    icon: ShieldCheck,
    title: 'Senha = 6 dígitos do CPF',
    body: 'Só os seis primeiros. Ex.: 123.456.789-00 → 123456.',
  },
];

const MEMBRO_AFTER: GuideItem[] = [
  { icon: CalendarDays, title: 'Giras', body: 'Agenda da casa e confirmação de presença.' },
  { icon: Wallet, title: 'Mensalidade', body: 'Pendências, Pix e envio de comprovante.' },
  { icon: Flame, title: 'Obrigações', body: 'Orientações da sua caminhada.' },
  { icon: Megaphone, title: 'Comunicados', body: 'Recados publicados pela casa.' },
  { icon: MessageCircle, title: 'Conversas', body: 'Chat direto com a zeladoria.' },
  { icon: BookOpen, title: 'Biblioteca e loja', body: 'Materiais e reservas da casa.' },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function InstrucoesUsoPage({ audience = 'zelador' }: { audience?: Audience }) {
  const isMembro = audience === 'membro';
  const loginHref = isMembro ? `${ROUTES.login}?modo=filho` : `${ROUTES.login}?modo=zelador`;

  return (
    <div className={cn('guide-page', isMembro ? 'is-membro' : 'is-zelador')}>
      <div className="guide-page__atmosphere" aria-hidden />

      <header className="guide-page__top">
        <a href={ROUTES.login} className="guide-page__back">
          <ArrowLeft aria-hidden />
          Login
        </a>
        <nav className="guide-page__audience" aria-label="Tipo de guia">
          <a href={ROUTES.instrucoes} className={cn(!isMembro && 'is-active')} aria-current={!isMembro ? 'page' : undefined}>
            Zelador
          </a>
          <a
            href={ROUTES.instrucoesMembro}
            className={cn(isMembro && 'is-active')}
            aria-current={isMembro ? 'page' : undefined}
          >
            Membro
          </a>
        </nav>
      </header>

      <section className="guide-page__hero">
        <motion.div {...fadeUp} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="guide-page__hero-inner">
          <p className="guide-page__brand">
            Axé<span>Cloud</span>
          </p>
          <h1>
            {isMembro ? (
              <>
                Como entrar
                <br />
                na corrente.
              </>
            ) : (
              <>
                Como cuidar
                <br />
                da casa no app.
              </>
            )}
          </h1>
          <p className="guide-page__lead">
            {isMembro
              ? 'Três passos. Sem e-mail. Sem senha de WhatsApp.'
              : 'Do cadastro ao aviso: o essencial no primeiro acesso.'}
          </p>
          <div className="guide-page__hero-cta">
            <a href={loginHref} className="guide-page__btn-primary">
              Ir para o login
              <ArrowRight aria-hidden />
            </a>
            <a href={isMembro ? ROUTES.instrucoes : ROUTES.instrucoesMembro} className="guide-page__btn-ghost">
              {isMembro ? 'Sou zelador' : 'Sou membro'}
            </a>
          </div>
        </motion.div>

        <motion.aside
          {...fadeUp}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="guide-page__hero-aside"
        >
          {isMembro ? (
            <>
              <span className="guide-page__aside-kicker">Exemplo de senha</span>
              <p className="guide-page__aside-title">
                CPF <em>123.456.789-00</em>
              </p>
              <p className="guide-page__aside-result">
                Senha <strong>123456</strong>
              </p>
            </>
          ) : (
            <>
              <span className="guide-page__aside-kicker">Importante</span>
              <p className="guide-page__aside-title">WhatsApp sem celular pareado</p>
              <p className="guide-page__aside-copy">
                Os envios saem pelo canal Business oficial do AxéCloud. Você não escaneia QR Code.
              </p>
            </>
          )}
        </motion.aside>
      </section>

      <main className="guide-page__main">
        {isMembro ? <MembroGuide loginHref={loginHref} /> : <ZeladorGuide />}
      </main>

      <footer className="guide-page__foot">
        <a href={loginHref} className="guide-page__btn-primary">
          Entrar agora
          <ArrowRight aria-hidden />
        </a>
        <p>axecloud.com.br</p>
      </footer>
    </div>
  );
}

function ZeladorGuide() {
  return (
    <>
      <motion.section
        {...fadeUp}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="guide-page__section"
        aria-labelledby="zelador-orientar"
      >
        <p className="guide-page__kicker">O que mais confunde</p>
        <h2 id="zelador-orientar">Oriente o membro assim</h2>
        <ol className="guide-page__path">
          {['Abrir /entrar e escolher Membro', 'Digitar o Registro AXC-…', 'Senha = 6 dígitos do CPF'].map(
            (step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </li>
            ),
          )}
        </ol>
        <p className="guide-page__note">
          Guia deles:{' '}
          <a href={ROUTES.instrucoesMembro}>axecloud.com.br/instrucoes/membro</a>
        </p>
      </motion.section>

      <section className="guide-page__section" aria-labelledby="zelador-casa">
        <p className="guide-page__kicker">Na prática</p>
        <h2 id="zelador-casa">Cuidar da casa no AxéCloud</h2>
        <ul className="guide-page__list">
          {ZELADOR_PATH.map((item, index) => (
            <motion.li
              key={item.title}
              {...fadeUp}
              transition={{ delay: 0.08 + index * 0.04, duration: 0.35 }}
            >
              <span className="guide-page__list-icon" aria-hidden>
                <item.icon />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>
    </>
  );
}

function MembroGuide({ loginHref }: { loginHref: string }) {
  return (
    <>
      <section className="guide-page__section" aria-labelledby="membro-passos">
        <p className="guide-page__kicker">Entrada</p>
        <h2 id="membro-passos">Três passos</h2>
        <ol className="guide-page__steps">
          {MEMBRO_STEPS.map((step, index) => (
            <motion.li
              key={step.title}
              {...fadeUp}
              transition={{ delay: 0.08 + index * 0.07, duration: 0.4 }}
            >
              <span className="guide-page__step-num" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>
                  <step.icon aria-hidden />
                  {step.title}
                </h3>
                <p>{step.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
        <a href={loginHref} className="guide-page__inline-cta">
          Já sei — ir ao login
          <ArrowRight aria-hidden />
        </a>
      </section>

      <motion.section
        {...fadeUp}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="guide-page__section"
        aria-labelledby="membro-depois"
      >
        <p className="guide-page__kicker">Depois de entrar</p>
        <h2 id="membro-depois">O que a casa libera</h2>
        <ul className="guide-page__features">
          {MEMBRO_AFTER.map((item) => (
            <li key={item.title}>
              <item.icon aria-hidden />
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.section
        {...fadeUp}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="guide-page__help"
        aria-labelledby="membro-ajuda"
      >
        <h2 id="membro-ajuda">Não consegue entrar?</h2>
        <p>
          Confira se escolheu <strong>Membro</strong>, se o registro está igual ao do WhatsApp e se os 6
          dígitos estão certos. Se falhar, peça ao zelador para reenviar o acesso na Corrente.
        </p>
      </motion.section>
    </>
  );
}
