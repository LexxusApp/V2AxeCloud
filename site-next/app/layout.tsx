import type { Metadata, Viewport } from "next";
import "@fontsource-variable/outfit";
import "./globals.css";
import "./cinematic.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://axecloud.com.br"),
  title: {
    default: "Software de Gestão para Terreiros | AxéCloud",
    template: "%s | AxéCloud",
  },
  description: "Software para terreiro de Umbanda, Candomblé e Jurema. Organize filhos de santo, mensalidades, giras, comunicados, patrimônio e memória no AxéCloud.",
  keywords: ["software para terreiro", "sistema para terreiro", "AxéCloud", "software Umbanda", "software Candomblé", "mensalidade terreiro", "filhos de santo", "agenda de giras"],
  applicationName: "AxéCloud",
  creator: "AxéCloud",
  publisher: "AxéCloud",
  category: "Tecnologia e gestão para terreiros",
  manifest: "/site.webmanifest",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "AxéCloud",
    title: "Software de Gestão para Terreiros | AxéCloud",
    description: "Software para terreiro de Umbanda, Candomblé e Jurema: filhos de santo, mensalidades, giras, comunicados, patrimônio e memória em um só lugar.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "AxéCloud — Toda casa carrega uma história" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Software de Gestão para Terreiros | AxéCloud",
    description: "Software completo para terreiros de Umbanda, Candomblé e Jurema.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: [
      { url: "/icon-32.png?v=axecloud-tridente-preto-3", sizes: "32x32", type: "image/png" },
      { url: "/icon-48.png?v=axecloud-tridente-preto-3", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/icon-32.png?v=axecloud-tridente-preto-3",
    apple: [{ url: "/icon-192.png?v=axecloud-tridente-preto-3", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2eee3" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f0b" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
