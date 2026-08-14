"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import "../access.css";

type Role = "zelador" | "membro";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("modo");
  const [role, setRole] = useState<Role>(() => requestedMode === "filho" || requestedMode === "membro" ? "membro" : "zelador");
  const [showPassword, setShowPassword] = useState(false);
  const realLogin = `https://axecloud.com.br/entrar?modo=${role === "membro" ? "filho" : "zelador"}`;

  return <main className="access-page"><div className="access-shell">
    <section className="access-story">
      <Link className="access-brand" href="/"><Image src="/axecloud-trident.png" alt="" width={48} height={48} priority /><strong>Axé<em>Cloud</em></strong></Link>
      <div className="access-story-copy">
        <p className="access-kicker">ACESSO À SUA CASA</p>
        <h1>Entre.<br /><span>A casa continua.</span></h1>
        <p>Um acesso para quem cuida da gestão. Outro para quem faz parte da corrente. Cada pessoa vê somente o que precisa.</p>
        <ul className="access-signals"><li><ShieldCheck /><strong>Ambiente protegido</strong><span>Dados isolados por casa.</span></li><li><UsersRound /><strong>Dois acessos</strong><span>Zeladoria e membros.</span></li><li><LockKeyhole /><strong>Privacidade</strong><span>Permissões bem definidas.</span></li></ul>
      </div>
      <p className="access-story-foot">AxéCloud · Gestão profissional para casas de axé</p>
    </section>

    <section className="access-panel">
      <Link className="access-back" href="/"><ArrowLeft /> Voltar ao site</Link>
      <div className="access-card">
        <header className="access-card-head"><div><small>ENTRAR NO AXÉCLOUD</small><h2>Quem está entrando?</h2></div><span className="access-secure"><i /> ACESSO SEGURO</span></header>
        <div className="access-role" role="tablist" aria-label="Escolha o tipo de acesso">
          <button type="button" role="tab" aria-selected={role === "zelador"} className={role === "zelador" ? "active" : ""} onClick={() => setRole("zelador")}><UserRound /><span><strong>Zelador</strong><span>Gestão da casa</span></span></button>
          <button type="button" role="tab" aria-selected={role === "membro"} className={role === "membro" ? "active" : ""} onClick={() => setRole("membro")}><UsersRound /><span><strong>Filho de santo</strong><span>Portal do membro</span></span></button>
        </div>

        <form className="access-form" onSubmit={(event) => { event.preventDefault(); window.location.assign(realLogin); }}>
          {role === "zelador" ? <>
            <label className="access-field"><span>E-mail cadastrado</span><div className="access-input"><Mail /><input type="email" autoComplete="username" placeholder="voce@suacasa.com.br" required /></div></label>
            <label className="access-field"><span>Senha</span><div className="access-input"><KeyRound /><input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" required /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          </> : <>
            <label className="access-field"><span>Registro da casa</span><div className="access-input"><UsersRound /><input type="text" inputMode="text" placeholder="Ex.: AXC-2026-B2CA" required /></div></label>
            <p className="access-hint">O registro chega pelo WhatsApp da casa. Você pode digitar com ou sem hífen.</p>
            <label className="access-field"><span>Senha — 6 primeiros dígitos do CPF</span><div className="access-input"><KeyRound /><input type={showPassword ? "text" : "password"} inputMode="numeric" maxLength={6} placeholder="123456" required /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          </>}
          <button className="access-submit" type="submit"><span>{role === "zelador" ? "Continuar como zelador" : "Continuar como filho de santo"}</span><ArrowRight /></button>
        </form>
        <div className="access-links"><Link href={role === "zelador" ? "/instrucoes" : "/instrucoes/membro"}>Ver instruções de acesso</Link>{role === "zelador" && <a href="https://axecloud.com.br/recuperar-senha">Esqueci minha senha</a>}</div>
        <p className="access-note">Por segurança, a autenticação é concluída no ambiente protegido do sistema AxéCloud.</p>
      </div>
    </section>
  </div></main>;
}
