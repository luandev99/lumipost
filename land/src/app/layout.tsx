import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const display = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lumipost.com.br"),
  title: {
    default: "Lumipost — sua semana de conteúdo criada e agendada por IA",
    template: "%s · Lumipost",
  },
  description:
    "O Lumipost planeja, gera e publica posts, carrosséis e stories no tom da sua marca, direto no seu Instagram profissional. Você aprova, ele publica.",
  keywords: [
    "agendamento de posts",
    "conteúdo com IA",
    "social media",
    "Instagram",
    "planejamento semanal",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://lumipost.com.br",
    siteName: "Lumipost",
    title: "Lumipost — sua semana de conteúdo criada e agendada por IA",
    description:
      "Planeje, gere e publique conteúdo para o seu Instagram sem sair do lugar. Você aprova, o Lumipost publica.",
    images: [
      {
        url: "/assets/og.png",
        width: 1200,
        height: 630,
        alt: "Lumipost — sua semana de conteúdo criada e agendada por IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumipost — sua semana de conteúdo criada e agendada por IA",
    description:
      "Planeje, gere e publique conteúdo para o seu Instagram sem sair do lugar.",
    images: ["/assets/og.png"],
  },
  icons: {
    icon: [
      { url: "/assets/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/logo.png", sizes: "256x256", type: "image/png" },
    ],
    apple: "/assets/logo-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${display.variable} antialiased`}
    >
      <body className="grain relative min-h-screen bg-app-bg text-app-text">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
