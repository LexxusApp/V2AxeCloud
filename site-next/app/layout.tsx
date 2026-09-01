import type { Metadata, Viewport } from "next";
import "@fontsource-variable/outfit";
import "./globals.css";
import "./cinematic.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://axecloud.com.br"),
  title: {
    default: "AxéCloud | Sistema de Gestão para Terreiros",
    template: "%s | AxéCloud",
  },
  description: "O AxéCloud é um sistema de gestão para terreiros de Umbanda e Candomblé. Organize filhos de santo, mensalidades, giras, comunicados e documentos.",
  keywords: ["gestão de terreiros", "sistema para terreiro", "software para terreiro", "gestão Umbanda", "gestão Candomblé", "mensalidade terreiro", "filhos de santo", "agenda de giras"],
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
    title: "AxéCloud | Sistema de Gestão para Terreiros",
    description: "Sistema de gestão para terreiros de Umbanda e Candomblé: filhos de santo, mensalidades, giras, comunicados e documentos em um só lugar.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "AxéCloud — Toda casa carrega uma história" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AxéCloud | Sistema de Gestão para Terreiros",
    description: "Gestão completa para terreiros de Umbanda, Candomblé e Jurema.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: [
      { url: "/icon-32.png?v=axecloud-tridente-2", sizes: "32x32", type: "image/png" },
      { url: "/icon-48.png?v=axecloud-tridente-2", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/icon-32.png?v=axecloud-tridente-2",
    apple: [{ url: "/icon-192.png?v=axecloud-tridente-2", sizes: "192x192", type: "image/png" }],
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
