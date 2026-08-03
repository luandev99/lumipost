import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Plus,
  ShieldCheck,
  WalletCards,
  Zap,
} from "lucide-react";
import type { CreditTransaction, Plan } from "../../../domain/models";
import {
  CREDIT_PACKAGES,
  MANUAL_SCHEDULE_CREDIT_COST,
  type CreditPackageId,
} from "../../../domain/creditRules";
import {
  useAppDispatch,
  useAppSelector,
} from "../../../presentation/store/hooks";
import {
  fetchCreditTransactions,
  openBillingPortal,
  refreshCredits,
  restoreSession,
  startBillingCheckout,
} from "../../../presentation/store/store";
import {
  Badge,
  Button,
  Card,
  Modal,
  Notice,
  PageHeader,
} from "../../../presentation/ui";
import { errorMessage } from "../../../presentation/utils/errors";
import { CreditUsageChart } from "../components/CreditUsageChart";

type BillingCycle = "month" | "year";
type CheckoutTarget =
  | { kind: "plan"; planId: BillingCycle }
  | { kind: "credits"; packageId: CreditPackageId };

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BillingPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user)!;
  const subscription = useAppSelector((state) => state.subscription.current);
  const creditBalance = useAppSelector((state) => state.credits.current);
  const availableCredits =
    creditBalance?.available ?? subscription?.credits ?? 0;
  const plans = useAppSelector((state) => state.subscription.plans);
  const [cycle, setCycle] = useState<BillingCycle>(
    subscription?.planId === "year" ? "year" : "month",
  );
  const [target, setTarget] = useState<CheckoutTarget>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [usageRange, setUsageRange] = useState<"7" | "30" | "90">("30");
  const [transactions, setTransactions] = useState<CreditTransaction[]>();
  useEffect(() => {
    setTransactions(undefined);
    dispatch(fetchCreditTransactions(Number(usageRange)))
      .unwrap()
      .then(setTransactions)
      .catch(() => setTransactions([]));
  }, [dispatch, usageRange]);
  const onboarding = location.pathname === "/assinar";
  const monthly = plans.find((plan) => plan.id === "month");
  const annual = plans.find((plan) => plan.id === "year");
  const selectedPlan = (cycle === "year" ? annual : monthly) as
    | Plan
    | undefined;
  const activePlan = plans.find((plan) => plan.id === subscription?.planId);
  const annualSavings =
    monthly && annual ? monthly.price * 12 - annual.price : 0;
  const targetPackage =
    target?.kind === "credits"
      ? CREDIT_PACKAGES.find((item) => item.id === target.packageId)
      : undefined;
  const targetPlan =
    target?.kind === "plan"
      ? plans.find((item) => item.id === target.planId)
      : undefined;
  const checkoutTotal = targetPlan?.price ?? targetPackage?.price ?? 0;
  const checkoutTitle =
    target?.kind === "credits"
      ? `Pacote ${targetPackage?.name}`
      : "Lumipost Pro";
  const checkoutDescription =
    target?.kind === "credits"
      ? `${targetPackage?.credits} créditos adicionais`
      : `${targetPlan?.id === "year" ? "Assinatura anual" : "Assinatura mensal"} · ${targetPlan?.credits} créditos`;
  const isCurrentCycle = subscription?.planId === cycle;
  const planBenefits = useMemo(
    () => [
      "Planejamento semanal completo",
      "Criação de Post, Carrossel, Story e Reel",
      "Agendamento e calendário editorial",
      "Templates e identidade da marca",
      "Créditos adicionais quando precisar",
    ],
    [],
  );

  const startCheckout = (nextTarget: CheckoutTarget) => {
    setError("");
    setMessage("");
    setTarget(nextTarget);
  };

  useEffect(() => {
    const checkoutStatus = new URLSearchParams(location.search).get("checkout");
    let active = true;
    if (checkoutStatus === "success") {
      setMessage(
        "Pagamento recebido. O saldo será atualizado automaticamente após a confirmação do Stripe.",
      );
      void (async () => {
        for (let attempt = 0; attempt < 8 && active; attempt += 1) {
          const [restored] = await Promise.all([
            dispatch(restoreSession())
              .unwrap()
              .catch(() => undefined),
            dispatch(refreshCredits())
              .unwrap()
              .catch(() => undefined),
          ]);
          if (restored?.subscription) {
            if (onboarding) navigate("/dashboard", { replace: true });
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
        if (active && onboarding)
          setMessage(
            "O Stripe confirmou o retorno. A ativação ainda está sendo processada; esta tela atualizará pelo webhook.",
          );
      })();
    } else if (checkoutStatus === "canceled") {
      setError("Checkout cancelado. Nenhuma cobrança foi realizada.");
    }
    return () => {
      active = false;
    };
  }, [dispatch, location.search, navigate, onboarding]);

  const openPortal = async () => {
    setError("");
    try {
      const result = await dispatch(openBillingPortal()).unwrap();
      window.location.assign(result.portalUrl);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível abrir o portal."));
    }
  };

  const pay = async () => {
    if (!target) return;
    setLoading(true);
    setError("");
    try {
      const result = await dispatch(
        startBillingCheckout({ userId: user.id, ...target }),
      ).unwrap();
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível concluir a compra."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-safe mx-auto max-w-6xl animate-fade-up">
      <PageHeader
        eyebrow="Assinatura e créditos"
        title={
          onboarding
            ? "Escolha como sua marca vai crescer"
            : "Créditos para publicar no seu ritmo"
        }
        description="Um único plano Lumipost Pro, com cobrança mensal ou anual. Compre créditos extras somente quando precisar."
        action={
          subscription && (
            <div className="rounded-2xl border border-app-border bg-app-surface px-4 py-3 shadow-[var(--shadow-card)]">
              <span className="text-muted block text-[10px] font-bold uppercase tracking-wider">
                Saldo disponível
              </span>
              <b className="mt-0.5 block text-xl text-app-primary">
                {availableCredits} créditos
              </b>
            </div>
          )
        }
      />

      {message && (
        <div className="mb-5">
          <Notice tone="success">
            <div>
              <b>Compra concluída</b>
              <p className="mt-0.5 text-xs">{message}</p>
            </div>
          </Notice>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <main className="space-y-6">
          <Card className="relative overflow-hidden p-5 sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">Lumipost Pro</Badge>
                    {cycle === "year" && (
                      <Badge tone="success">
                        Economize {currency(annualSavings)}
                      </Badge>
                    )}
                  </div>
                  <h2 className="mt-4 text-2xl font-bold">
                    Tudo para planejar, criar e publicar
                  </h2>
                  <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed">
                    Escolha apenas o ciclo de pagamento. Os recursos do plano
                    são os mesmos no mensal e no anual.
                  </p>
                </div>
                <div className="flex shrink-0 rounded-full border border-app-border bg-app-elevated p-1">
                  <button
                    type="button"
                    onClick={() => setCycle("month")}
                    className={`min-h-10 rounded-full px-4 text-sm font-bold transition ${cycle === "month" ? "bg-app-surface text-app-primary shadow-sm" : "text-app-muted"}`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setCycle("year")}
                    className={`min-h-10 rounded-full px-4 text-sm font-bold transition ${cycle === "year" ? "bg-app-surface text-app-primary shadow-sm" : "text-app-muted"}`}
                  >
                    Anual
                  </button>
                </div>
              </div>

              <div className="mt-7 grid gap-6 lg:grid-cols-[250px_1fr]">
                <div className="rounded-3xl border border-violet-400/25 bg-app-soft p-5">
                  <span className="text-muted text-xs">
                    {cycle === "year" ? "Plano anual" : "Plano mensal"}
                  </span>
                  <div className="mt-2">
                    <b className="text-4xl tracking-tight text-app-primary">
                      {currency(selectedPlan?.price ?? 0)}
                    </b>
                    <span className="text-muted text-xs">
                      /{cycle === "year" ? "ano" : "mês"}
                    </span>
                  </div>
                  {cycle === "year" && (
                    <p className="mt-2 text-xs font-semibold text-app-primary">
                      {selectedPlan?.installments?.count ?? 12}× de{" "}
                      {currency(
                        selectedPlan?.installments?.value ??
                          (selectedPlan?.price ?? 0) / 12,
                      )}
                    </p>
                  )}
                  <div className="my-5 border-y border-violet-400/15 py-4">
                    <b className="block text-2xl">
                      {selectedPlan?.credits ?? 0}
                    </b>
                    <span className="text-muted text-xs">
                      créditos incluídos por ciclo
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!selectedPlan || isCurrentCycle}
                    onClick={() => {
                      if (subscription) void openPortal();
                      else if (selectedPlan)
                        startCheckout({ kind: "plan", planId: cycle });
                    }}
                  >
                    {isCurrentCycle ? (
                      <>
                        <CheckCircle2 size={16} />
                        Plano atual
                      </>
                    ) : subscription ? (
                      "Mudar para este ciclo"
                    ) : (
                      "Assinar Lumipost Pro"
                    )}
                  </Button>
                </div>
                <ul className="grid content-start gap-3 sm:grid-cols-2">
                  {planBenefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex min-h-12 items-center gap-3 rounded-2xl border border-app-border bg-app-elevated/60 px-4 text-sm font-semibold"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                        <Check size={14} />
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-1">
              <p className="eyebrow">Uso de créditos</p>
              <h2 className="mt-1 text-xl font-bold">Entradas e saídas</h2>
            </div>
            <CreditUsageChart
              transactions={transactions ?? []}
              loading={transactions === undefined}
              range={usageRange}
              onRangeChange={setUsageRange}
            />
          </Card>

          <section>
            <div className="mb-4">
              <p className="eyebrow">Créditos adicionais</p>
              <h2 className="mt-1 text-2xl font-bold">
                Recarregue sem alterar seu plano
              </h2>
              <p className="text-muted mt-1 text-sm">
                Os créditos entram imediatamente no saldo e permanecem
                disponíveis durante a assinatura ativa.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {CREDIT_PACKAGES.map((creditPackage) => (
                <Card
                  key={creditPackage.id}
                  className={`relative flex flex-col p-5 ${creditPackage.featured ? "border-violet-400/50 ring-1 ring-violet-400/20" : ""}`}
                >
                  {creditPackage.featured && (
                    <span className="absolute right-4 top-4 rounded-full bg-app-primary px-2.5 py-1 text-[10px] font-bold text-white">
                      Mais escolhido
                    </span>
                  )}
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                    <Zap size={19} />
                  </span>
                  <h3 className="mt-4 font-bold">{creditPackage.name}</h3>
                  <div className="mt-2">
                    <b className="text-3xl text-app-primary">
                      {creditPackage.credits}
                    </b>
                    <span className="text-muted ml-1 text-xs">créditos</span>
                  </div>
                  <p className="text-muted mt-2 min-h-8 text-xs">
                    {creditPackage.description}
                  </p>
                  <div className="mt-5 flex items-end justify-between border-t border-app-border pt-4">
                    <div>
                      <b className="block text-lg">
                        {currency(creditPackage.price)}
                      </b>
                      <span className="text-muted text-[10px]">
                        pagamento único
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!subscription}
                      onClick={() =>
                        startCheckout({
                          kind: "credits",
                          packageId: creditPackage.id,
                        })
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-app-primary text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Comprar ${creditPackage.credits} créditos`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
            {!subscription && (
              <div className="mt-3">
                <Notice>
                  Ative o Lumipost Pro para liberar a compra de créditos
                  adicionais.
                </Notice>
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                <WalletCards size={19} />
              </span>
              <div>
                <p className="eyebrow">Sua assinatura</p>
                <h2 className="font-bold">
                  {activePlan?.name ?? "Ainda não ativada"}
                </h2>
              </div>
            </div>
            {subscription ? (
              <div className="mt-5 space-y-3 border-t border-app-border pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Saldo atual</span>
                  <b className="text-app-primary">{availableCredits}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Ciclo</span>
                  <b>{subscription.planId === "year" ? "Anual" : "Mensal"}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Status</span>
                  <Badge tone="success">Ativo</Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted mt-4 text-sm">
                Escolha mensal ou anual para começar.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <CalendarCheck className="text-app-primary" size={18} />
              <h2 className="font-bold">Como os créditos são usados</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Agendamento manual</span>
                <b>{MANUAL_SCHEDULE_CREDIT_COST} créditos</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Post, Story ou capa IA</span>
                <b>5 créditos</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Carrossel com IA</span>
                <b>5 por slide</b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Vídeo com IA</span>
                <b>15 créditos</b>
              </div>
            </div>
            <p className="text-muted mt-4 border-t border-app-border pt-4 text-[11px] leading-relaxed">
              Planejar e visualizar prévias não consome créditos. A cobrança
              aparece antes da confirmação.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-green-500">
              <ShieldCheck size={18} />
              <b className="text-sm">Checkout protegido pelo Stripe</b>
            </div>
            <p className="text-muted mt-2 text-xs leading-relaxed">
              Os dados de pagamento são coletados no Checkout hospedado do
              Stripe. A Lumipost não recebe nem armazena número de cartão.
            </p>
            {subscription && (
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => void openPortal()}
              >
                Gerenciar assinatura
              </Button>
            )}
          </Card>
        </aside>
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => !loading && setTarget(undefined)}
        title="Continuar para o Checkout"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-app-border bg-app-elevated p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
                  Resumo do pedido
                </span>
                <b className="mt-1 block">{checkoutTitle}</b>
                <p className="text-muted mt-1 text-xs">{checkoutDescription}</p>
              </div>
              <b className="shrink-0 text-lg text-app-primary">
                {currency(checkoutTotal)}
              </b>
            </div>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Notice>
            O pagamento será feito no ambiente seguro do Stripe. O plano ou os
            créditos só serão liberados depois que o webhook assinado confirmar
            a cobrança.
          </Notice>
          <Button
            loading={loading}
            className="w-full"
            onClick={() => void pay()}
          >
            <CreditCard size={17} />
            Ir ao Stripe para{" "}
            {target?.kind === "credits" ? "compra" : "assinatura"} de{" "}
            {currency(checkoutTotal)}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
