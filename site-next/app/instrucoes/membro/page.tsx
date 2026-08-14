import type { Metadata } from "next";
import GuidePage from "../GuidePage";

export const metadata: Metadata = {
  title: "Instruções para filhos de santo",
  description: "Guia de acesso ao portal do filho de santo no AxéCloud.",
  alternates: { canonical: "/instrucoes/membro" },
  robots: { index: false, follow: true },
};

export default function MemberInstructionsPage(){ return <GuidePage audience="membro" />; }
