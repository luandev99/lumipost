import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";
import {
  AppLayout,
  AdminLayout,
  AuthLayout,
  Bootstrapper,
  ThemeSync,
} from "./layouts";
import { useAppSelector } from "./store/hooks";
import {
  LoginPage,
  OAuthCallbackPage,
  OnboardingPage,
  RegisterPage,
} from "./pages/AuthPages";
import {
  AdminDashboardPage,
  AdminPlansPage,
  AdminPromptsPage,
  AdminQueuePage,
  AdminTemplatesPage,
  AdminUsersPage,
} from "./pages/AdminPages";
import { TemplateEditorPage } from "./pages/TemplateEditorPage";
import { BrandMark, Button, Card } from "./ui";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { CalendarPage } from "../features/calendar/pages/CalendarPage";
import { WeeklyPlanningPage } from "../features/planning/pages/WeeklyPlanningPage";
import { WeeklyPlanProgressPage } from "../features/planning/pages/WeeklyPlanProgressPage";
import { WeeklyPlanHistoryPage } from "../features/planning/pages/WeeklyPlanHistoryPage";
import { ContentCreatePage } from "../features/content/pages/ContentCreatePage";
import { ContentLibraryPage } from "../features/content/pages/ContentLibraryPage";
import { ContentDetailsPage } from "../features/content/pages/ContentDetailsPage";
import {
  BrandPage,
  SettingsPage,
  SocialAccountsPage,
} from "../features/settings/pages/UserSettingsPages";
import { BillingPage } from "../features/billing/pages/BillingPage";
import { DataDeletionPage, PrivacyPolicyPage } from "./pages/LegalPages";

function RootRedirect() {
  const user = useAppSelector((state) => state.auth.user);
  const sub = useAppSelector((state) => state.subscription.current);
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (!user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  if (!sub) return <Navigate to="/assinar" replace />;
  return <Navigate to="/dashboard" replace />;
}
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.onboardingCompleted) return <Navigate to="/assinar" replace />;
  return children;
}
function SubscribeGuard({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (!user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return children;
}
function AppGuard() {
  const user = useAppSelector((state) => state.auth.user);
  const subscription = useAppSelector((state) => state.subscription.current);
  const location = useLocation();
  if (!user)
    return <Navigate to="/entrar" state={{ from: location }} replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (!user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  if (!subscription) return <Navigate to="/assinar" replace />;
  return <AppLayout />;
}
function AdminGuard() {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <AdminLayout />;
}
function NotFound() {
  return (
    <div className="auth-shell flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        <p className="eyebrow">Erro 404</p>
        <h1 className="mt-2 text-2xl font-bold">
          Esta página saiu do calendário
        </h1>
        <p className="text-muted mt-2 text-sm">
          Volte para o início e continue criando.
        </p>
        <Button className="mt-6" onClick={() => location.assign("/")}>
          Voltar ao início
        </Button>
      </Card>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/privacidade", element: <PrivacyPolicyPage /> },
  { path: "/exclusao-de-dados", element: <DataDeletionPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: "/entrar", element: <LoginPage /> },
      { path: "/registrar", element: <RegisterPage /> },
      { path: "/auth/callback", element: <OAuthCallbackPage /> },
      {
        path: "/onboarding",
        element: (
          <OnboardingGuard>
            <OnboardingPage />
          </OnboardingGuard>
        ),
      },
      {
        path: "/assinar",
        element: (
          <SubscribeGuard>
            <BillingPage />
          </SubscribeGuard>
        ),
      },
    ],
  },
  {
    element: <AppGuard />,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/calendar", element: <CalendarPage /> },
      { path: "/calendar/week", element: <CalendarPage initialView="week" /> },
      {
        path: "/calendar/month",
        element: <CalendarPage initialView="month" />,
      },
      { path: "/content/create", element: <ContentCreatePage /> },
      { path: "/content/create/ai", element: <ContentCreatePage /> },
      { path: "/content/create/manual", element: <ContentCreatePage /> },
      { path: "/content/upload", element: <ContentCreatePage /> },
      { path: "/content/library", element: <ContentLibraryPage /> },
      { path: "/content/:id", element: <ContentDetailsPage /> },
      { path: "/content/:id/edit", element: <ContentDetailsPage edit /> },
      { path: "/planning/new", element: <WeeklyPlanningPage /> },
      { path: "/planning/history", element: <WeeklyPlanHistoryPage /> },
      { path: "/planning/:planId", element: <WeeklyPlanProgressPage /> },
      { path: "/brand", element: <BrandPage /> },
      { path: "/social-accounts", element: <SocialAccountsPage /> },
      { path: "/credits", element: <BillingPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/app/planejar", element: <Navigate to="/calendar" replace /> },
      {
        path: "/app/criar/:formato?",
        element: <Navigate to="/content/create" replace />,
      },
      {
        path: "/app/conteudos/:id?",
        element: <Navigate to="/content/library" replace />,
      },
      { path: "/app/menu", element: <Navigate to="/settings" replace /> },
      { path: "/app/assinatura", element: <BillingPage /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminGuard />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "usuarios", element: <AdminUsersPage /> },
      { path: "fila", element: <AdminQueuePage /> },
      { path: "planos", element: <AdminPlansPage /> },
      { path: "templates", element: <AdminTemplatesPage /> },
      { path: "templates/novo", element: <TemplateEditorPage /> },
      { path: "templates/:id", element: <TemplateEditorPage /> },
      { path: "prompts", element: <AdminPromptsPage /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

function RoutedApplication() {
  const ready = useAppSelector((state) => state.ui.bootstrapped);
  if (!ready)
    return (
      <div className="auth-shell flex min-h-screen items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-app-border border-t-app-primary"
          aria-label="Carregando sua conta"
        />
      </div>
    );
  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <>
      <ThemeSync />
      <Bootstrapper />
      <RoutedApplication />
    </>
  );
}
