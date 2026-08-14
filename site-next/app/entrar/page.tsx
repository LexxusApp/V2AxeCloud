import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel da sua casa ou o portal do filho de santo no AxéCloud.",
  alternates: { canonical: "/entrar" },
  robots: { index: false, follow: true },
  openGraph: {
    url: "/entrar",
    title: "Entrar no AxéCloud",
    description: "Acesso protegido para zeladores e membros da casa.",
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
