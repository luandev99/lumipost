import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  Library,
  Link2,
  Menu,
  Palette,
  PenTool,
  Plus,
  Settings,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { BrandMark, ThemeToggle } from "./ui";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { appContainer } from "../application/container";
import {
  bootstrapApp,
  creditsActions,
  logoutSession,
  restoreSession,
  subscriptionActions,
} from "./store/store";

export function ThemeSync() {
  const theme = useAppSelector((state) => state.ui.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}
export function Bootstrapper() {
  const dispatch = useAppDispatch();
  const ready = useAppSelector((state) => state.ui.bootstrapped);
  const organizationId = useAppSelector(
    (state) => state.auth.user?.organizationId,
  );

  useEffect(() => {
    if (!ready) {
      void dispatch(bootstrapApp()).then(() => dispatch(restoreSession()));
    }
  }, [dispatch, ready]);

  useEffect(() => {
    if (!organizationId) return;
    return appContainer.subscribeCreditBalance(organizationId, (balance) => {
      dispatch(creditsActions.sync(balance));
      dispatch(subscriptionActions.syncCredits(balance.available));
    });
  }, [dispatch, organizationId]);

  return null;
}

const desktopUserNav = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/calendar", label: "Calendário", icon: CalendarDays },
  { to: "/content/create", label: "Criar", icon: Sparkles },
  { to: "/content/library", label: "Conteúdos", icon: Library },
  { to: "/planning/new", label: "Planejamento", icon: WandSparkles },
  { to: "/brand", label: "Identidade", icon: Palette },
  { to: "/social-accounts", label: "Redes sociais", icon: Link2 },
  { to: "/credits", label: "Créditos", icon: CreditCard },
  { to: "/settings", label: "Configurações", icon: Settings },
];
const mobileUserNav = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/calendar", label: "Agenda", icon: CalendarDays },
  { to: "/content/create", label: "Criar", icon: Plus, primary: true },
  { to: "/content/library", label: "Conteúdos", icon: Library },
  { to: "/settings", label: "Mais", icon: Menu },
];
export function AppLayout() {
  const user = useAppSelector((state) => state.auth.user);
  const sub = useAppSelector((state) => state.subscription.current);
  const credits = useAppSelector((state) => state.credits.current);
  const availableCredits = credits?.available ?? sub?.credits ?? 0;
  const navigate = useNavigate();
  return (
    <div className="app-shell min-h-screen bg-app-bg text-app-text lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="glass relative z-30 hidden min-h-screen border-y-0 border-l-0 p-5 lg:flex lg:flex-col">
        <button className="text-left" onClick={() => navigate("/dashboard")}>
          <BrandMark />
        </button>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {desktopUserNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${isActive ? "bg-app-soft text-app-primary" : "text-app-muted hover:bg-app-elevated hover:text-app-text"}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          className="rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 p-4 text-left text-white"
          onClick={() => navigate("/credits")}
        >
          <span className="block text-[10px] font-bold uppercase tracking-widest text-violet-200">
            Saldo disponível
          </span>
          <b className="mt-1 block text-2xl">{availableCredits}</b>
          <span className="text-xs text-violet-100">créditos de IA</span>
        </button>
        <button
          className="mt-3 flex items-center justify-between rounded-2xl border border-app-border p-3 text-left"
          onClick={() => navigate("/settings")}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-700 font-bold text-white">
              {user?.name?.[0] ?? "U"}
            </span>
            <span className="min-w-0">
              <b className="block truncate text-sm">{user?.name}</b>
              <span className="text-muted block truncate text-xs">
                {user?.email}
              </span>
            </span>
          </span>
          <ChevronRight size={16} />
        </button>
      </aside>
      <div className="min-w-0">
        <header className="glass sticky top-0 z-30 border-x-0 border-t-0">
          <div className="flex h-[68px] items-center justify-between px-4 sm:px-7 lg:px-8">
            <button
              className="lg:hidden"
              onClick={() => navigate("/dashboard")}
            >
              <BrandMark compact />
            </button>
            <div className="hidden lg:block">
              <span className="text-muted text-xs">Conteúdo e agendamento</span>
              <b className="block text-sm">Central da sua marca</b>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="hidden min-h-10 items-center gap-2 rounded-full bg-app-soft px-3 text-xs font-bold text-app-primary sm:flex"
                onClick={() => navigate("/credits")}
              >
                <Sparkles size={14} />
                {availableCredits} créditos
              </button>
              <ThemeToggle />
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-700 font-bold text-white lg:hidden"
                onClick={() => navigate("/settings")}
                aria-label="Abrir perfil"
              >
                {user?.name?.[0] ?? "U"}
              </button>
            </div>
          </div>
        </header>
        <main className="app-content relative z-10 mx-auto min-h-[calc(100dvh-68px)] max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
      <nav className="mobile-bottom-nav glass fixed inset-x-3 z-40 grid grid-cols-5 rounded-[1.75rem] p-2 shadow-[var(--shadow-float)] lg:hidden">
        {mobileUserNav.map(({ to, label, icon: Icon, primary }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-bold transition ${primary ? "-mt-6" : ""} ${isActive && !primary ? "bg-app-soft text-app-primary" : "text-app-muted"}`
            }
          >
            <span
              className={
                primary
                  ? "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-800 text-white shadow-xl shadow-violet-500/30"
                  : ""
              }
            >
              <Icon size={primary ? 24 : 20} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const adminNav = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/admin/fila", label: "Fila", icon: Clock3 },
  { to: "/admin/planos", label: "Planos", icon: CreditCard },
  { to: "/admin/templates", label: "Templates", icon: PenTool },
  { to: "/admin/prompts", label: "Prompts", icon: FileText },
];
export function AdminLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  return (
    <div className="app-shell min-h-screen bg-app-bg text-app-text lg:grid lg:grid-cols-[255px_1fr]">
      <aside className="glass relative z-30 hidden min-h-screen border-y-0 border-l-0 p-5 lg:flex lg:flex-col">
        <BrandMark />
        <div className="mt-3 rounded-2xl bg-app-soft px-3 py-2 text-xs font-bold text-app-primary">
          Painel administrativo
        </div>
        <nav className="mt-7 flex flex-1 flex-col gap-1">
          {adminNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              end={end}
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isActive ? "bg-app-soft text-app-primary" : "text-app-muted hover:bg-app-elevated hover:text-app-text"}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          className="flex items-center justify-between rounded-2xl border border-app-border p-3 text-left"
          onClick={() => {
            void dispatch(logoutSession());
            navigate("/entrar");
          }}
        >
          <span>
            <span className="block text-sm font-bold">{user?.name}</span>
            <span className="text-muted text-xs">Sair do painel</span>
          </span>
          <ChevronRight size={17} />
        </button>
      </aside>
      <div>
        <header className="glass sticky top-0 z-30 flex h-[68px] items-center justify-between border-x-0 border-t-0 px-4 lg:px-8">
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <span className="hidden text-sm font-semibold lg:block">
            Central de operações
          </span>
          <ThemeToggle />
        </header>
        <div className="overflow-x-auto border-b border-app-border px-3 py-2 lg:hidden">
          <nav className="flex min-w-max gap-1">
            {adminNav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                end={end}
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-bold ${isActive ? "bg-app-soft text-app-primary" : "text-app-muted"}`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <main className="relative z-10 mx-auto max-w-[1500px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AuthLayout() {
  const location = useLocation();
  const wide = location.pathname === "/assinar";
  return (
    <div className="auth-shell relative min-h-screen bg-app-bg text-app-text">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <div
        className={`relative z-10 mx-auto flex min-h-screen items-center justify-center px-4 py-12 ${wide ? "max-w-7xl" : "max-w-6xl"}`}
      >
        <div
          className={`w-full animate-fade-up ${wide ? "max-w-6xl" : "max-w-md"}`}
        >
          <div className="mb-7 flex justify-center">
            <BrandMark />
          </div>
          <Outlet key={location.pathname} />
        </div>
      </div>
    </div>
  );
}
