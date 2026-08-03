import BrandMark from "./ui/BrandMark";
import { APP_URL, LOGIN_PATH, NAV_LINKS, REGISTER_PATH } from "@/lib/content";

const YEAR = new Date().getFullYear();

const COLUMNS = [
  {
    title: "Produto",
    links: NAV_LINKS.map((link) => ({ label: link.label, href: link.href })),
  },
  {
    title: "Conta",
    links: [
      { label: "Entrar", href: `${APP_URL}${LOGIN_PATH}` },
      { label: "Criar conta", href: `${APP_URL}${REGISTER_PATH}` },
      { label: "Suporte", href: "mailto:contato@lumipost.com.br" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de uso", href: "/termos" },
      { label: "Privacidade", href: "/privacidade" },
      { label: "Segurança", href: "/seguranca" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.07] bg-white/[0.012]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <BrandMark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-app-muted">
              Planejamento, geração e publicação de conteúdo com IA para quem não
              tem tempo de virar social media.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-app-muted">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-app-muted transition-colors hover:text-app-text"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/[0.07] pt-7 sm:flex-row sm:items-center">
          <p className="text-xs text-app-muted">
            © {YEAR} Lumipost · Todos os direitos reservados
          </p>
          <p className="text-xs text-app-muted/70">
            Feito no Brasil · Instagram é marca da Meta Platforms, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
