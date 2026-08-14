import type { Metadata } from "next";
import GuidePage from "./GuidePage";

export const metadata: Metadata = {
  title: "Instruções para zeladores",
  description: "Guia de acesso e primeiros passos do zelador no AxéCloud.",
  alternates: { canonical: "/instrucoes" },
  robots: { index: false, follow: true },
};

export default function ZeladorInstructionsPage(){ return <GuidePage audience="zelador" />; }
