import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, CircleHelp, KeyRound, LockKeyhole, MessageCircleMore, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import "../access.css";

const zeladorItems = [
  { icon: UsersRound, title: "Cadastre a corrente", body: "Informe nome, WhatsApp com DDD e CPF. Os seis primeiros dígitos do CPF serão a senha de acesso do membro." },
  { icon: KeyRound, title: "Explique como o membro entra", body: "Acesse /entrar, escolha Filho de santo e use o registro AXC-... junto dos seis primeiros dígitos do CPF." },
  { icon: MessageCircleMore, title: "WhatsApp sem QR Code", body: "Os avisos saem pelo WhatsApp Business oficial do AxéCloud. Não é preciso parear o celular da casa." },
  { icon: CalendarDays, title: "Organize giras e agenda", body: "Crie giras, convide pessoas, acompanhe confirmações e avise a corrente pelo canal oficial." },
  { icon: WalletCards, title: "Configure mensalidade e Pix", body: "Defina a chave Pix e o valor, acompanhe pendências e confirme pagamentos e comprovantes." },
  { icon: CircleHelp, title: "Fale com o suporte", body: "Se algo travar, use o suporte dentro do painel. A equipe AxéCloud responde pelo próprio sistema." },
];

const membroItems = [
  { icon: CalendarDays, title: "Giras", body: "Veja a agenda da casa e confirme sua presença." },
  { icon: WalletCards, title: "Mensalidade", body: "Consulte pendências, pague com Pix e envie comprovantes." },
  { icon: ShieldCheck, title: "Obrigações", body: "Acompanhe orientações liberadas para sua caminhada." },
  { icon: MessageCircleMore, title: "Comunicados", body: "Receba avisos e converse diretamente com a zeladoria." },
  { icon: BookOpen, title: "Biblioteca", body: "Acesse estudos e materiais autorizados pela casa." },
  { icon: LockKeyhole, title: "Acesso reservado", body: "Você vê somente o conteúdo que a sua casa libera." },
];

export default function GuidePage({ audience }: { audience: "zelador" | "membro" }) {
  const membro = audience === "membro";
  const items = membro ? membroItems : zeladorItems;
  return <main className="guide-page">
    <header className="guide-top"><Link className="access-brand" href="/"><Image src="/axecloud-trident.png" alt="" width={48} height={48} priority /><strong>Axé<em>Cloud</em></strong></Link><nav className="guide-nav" aria-label="Escolha o guia"><Link className={!membro ? "active" : ""} href="/instrucoes">Zelador</Link><Link className={membro ? "active" : ""} href="/instrucoes/membro">Filho de santo</Link></nav><Link className="guide-login" href={`/entrar?modo=${membro ? "filho" : "zelador"}`}><span>Entrar</span><ArrowRight /></Link></header>
    <section className="guide-hero"><div className="guide-hero-inner"><div><p className="guide-kicker">{membro ? "GUIA DO FILHO DE SANTO" : "GUIA DA ZELADORIA"}</p><h1>{membro ? <>Seu acesso.<br /><span>Sua caminhada.</span></> : <>Comece bem.<br /><span>Cuide com clareza.</span></>}</h1><p className="guide-hero-lead">{membro ? "Entre sem e-mail e encontre o que a sua casa preparou para você." : "O essencial para cadastrar a corrente, organizar a rotina e orientar os membros desde o primeiro acesso."}</p></div><aside className="guide-hero-aside">{membro ? <><KeyRound /><small>EXEMPLO DE SENHA</small><strong>CPF 123.456.789-00</strong><span>Digite somente: 123456</span></> : <><ShieldCheck /><small>IMPORTANTE</small><strong>WhatsApp oficial, sem celular pareado.</strong><span>As mensagens saem pela infraestrutura do AxéCloud. Você não escaneia QR Code.</span></>}</aside></div></section>
    <div className="guide-main">
      <section className="guide-orient"><div><p className="guide-section-tag">{membro ? "ENTRADA" : "ORIENTAÇÃO"}</p><h2>{membro ? "Três passos para entrar." : "Explique o acesso sem complicar."}</h2></div><ol className="guide-path">{(membro ? [["Escolha Filho de santo","Na página de entrada."],["Digite o registro AXC-...","Ele chega pelo WhatsApp da casa."],["Use seis dígitos do CPF","Não é a senha do WhatsApp nem do e-mail."]] : [["Abra a página Entrar","Escolha Filho de santo."],["Informe o registro AXC-...","Pode ser digitado com ou sem hífen."],["Senha = seis dígitos do CPF","Use somente os seis primeiros."]]).map(([title,note],i)=><li key={title}><span>0{i+1}</span><div><strong>{title}</strong><small>{note}</small></div></li>)}</ol></section>
      <section className="guide-section"><p className="guide-section-tag">{membro ? "DEPOIS DE ENTRAR" : "NA PRÁTICA"}</p><h2>{membro ? "O que a casa libera." : "Cuidar da casa no AxéCloud."}</h2><ul className="guide-grid">{items.map(item=><li key={item.title}><span><item.icon /></span><h3>{item.title}</h3><p>{item.body}</p></li>)}</ul></section>
      <section className="guide-help"><div><h2>{membro ? "Não consegue entrar?" : "Precisa de ajuda no primeiro acesso?"}</h2><p>{membro ? "Confira o registro, os seis dígitos e se escolheu Filho de santo. Se ainda falhar, peça ao zelador para reenviar o acesso." : "Entre no painel e use o suporte. A equipe orienta sua casa sem deixar você sozinho."}</p></div><Link href={`/entrar?modo=${membro ? "filho" : "zelador"}`}>Ir para o login <ArrowRight /></Link></section>
    </div>
  </main>;
}
