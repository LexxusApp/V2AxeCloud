import { BookOpen, FileText } from 'lucide-react';
import MarketingPageShell from '../components/marketing/MarketingPageShell';
import { ROUTES } from '../lib/routes';

const links = [
  {
    href: ROUTES.contentArticle,
    title: 'Como o AxéCloud ajuda terreiros a se organizar',
    description: 'Financeiro, almoxarifado, calendário e portal do filho de santo — visão geral do sistema.',
    Icon: FileText,
  },
  {
    href: ROUTES.glossary,
    title: 'Glossário do axé',
    description: '10 termos essenciais sobre terreiro, filho de santo, gira, orixá e tradições afro-brasileiras.',
    Icon: BookOpen,
  },
] as const;

export default function ContentHubPage() {
  return (
    <MarketingPageShell
      kicker="Portal AxéCloud"
      title="Conteúdo para quem busca entender a tradição"
      summary="Artigos e glossário com linguagem respeitosa — base do portal público que estamos construindo junto com as casas fundadoras."
    >
      <ul className="space-y-4">
        {links.map(({ href, title, description, Icon }) => (
          <li key={href}>
            <a
              href={href}
              className="group flex gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-primary/30"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white group-hover:text-primary">{title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{description}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-sm">
        <a href={ROUTES.founderProgram} className="font-bold text-primary hover:underline">
          Conheça o Programa Fundador →
        </a>
      </p>
    </MarketingPageShell>
  );
}
