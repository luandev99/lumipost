import { useMemo, useState } from "react";
import { Coins, Save, TrendingUp } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { saveAdminAiBudget } from "../store/store";
import { Button, Card, Input, Notice } from "../ui";
import { errorMessage } from "../utils/errors";

type Period = "today" | "7d" | "30d";

const periodDays: Record<Period, number> = { today: 1, "7d": 7, "30d": 30 };
const periodLabels: Record<Period, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
};

const usd = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const compactTokens = (tokens: number) =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(1)}M`
    : tokens >= 1_000
      ? `${(tokens / 1_000).toFixed(1)}k`
      : String(tokens);

export function AiCostPanel() {
  const dispatch = useAppDispatch();
  const usage = useAppSelector((state) => state.admin.aiUsage);
  const budgetCents = useAppSelector(
    (state) => state.admin.aiMonthlyBudgetCents,
  );
  const subscriptions = useAppSelector((state) => state.subscription.all);
  const plans = useAppSelector((state) => state.subscription.plans);
  const [period, setPeriod] = useState<Period>("30d");
  const [budgetInput, setBudgetInput] = useState(
    budgetCents ? String(budgetCents / 100) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const totals = useMemo(() => {
    const since = Date.now() - periodDays[period] * 24 * 60 * 60 * 1000;
    const window = usage.filter(
      (event) => new Date(event.createdAt).getTime() >= since,
    );
    return window.reduce(
      (acc, event) => ({
        costMillicents: acc.costMillicents + event.costMillicents,
        tokens: acc.tokens + event.totalTokens,
        calls: acc.calls + event.apiCalls,
        generations: acc.generations + 1,
        credits: acc.credits + event.creditsCharged,
      }),
      { costMillicents: 0, tokens: 0, calls: 0, generations: 0, credits: 0 },
    );
  }, [usage, period]);

  // Consumo do mês corrente é o que se compara com o teto declarado — o
  // seletor de período acima serve para inspeção, não para o orçamento.
  const monthCostCents = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return (
      usage
        .filter(
          (event) => new Date(event.createdAt).getTime() >= startOfMonth.getTime(),
        )
        .reduce((sum, event) => sum + event.costMillicents, 0) / 1000
    );
  }, [usage]);

  // Receita reconhecida das assinaturas ativas, em BRL. Serve para dar ordem
  // de grandeza contra o custo de IA — não é contabilidade, e as moedas são
  // diferentes (receita em BRL, custo da OpenAI em USD), então os dois números
  // aparecem lado a lado sem serem subtraídos um do outro.
  const monthlyRevenueBrl = useMemo(
    () =>
      subscriptions
        .filter((item) => item.status === "active")
        .reduce((sum, item) => {
          const plan = plans.find((entry) => entry.id === item.planId);
          if (!plan) return sum;
          return sum + (plan.id === "year" ? plan.price / 12 : plan.price);
        }, 0),
    [subscriptions, plans],
  );

  const budgetUsedPercent =
    budgetCents > 0 ? Math.min(100, (monthCostCents / budgetCents) * 100) : 0;
  const remainingCents = Math.max(0, budgetCents - monthCostCents);

  const saveBudget = async () => {
    setError("");
    setSaved(false);
    const parsed = Number(budgetInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Informe um valor válido em dólares.");
      return;
    }
    setSaving(true);
    try {
      await dispatch(saveAdminAiBudget(Math.round(parsed * 100))).unwrap();
      setSaved(true);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível salvar o teto."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Custo de IA</h2>
          <p className="text-muted text-sm">
            Tokens reportados pela OpenAI em cada geração.
          </p>
        </div>
        <div className="flex rounded-full border border-app-border bg-app-elevated p-1">
          {(Object.keys(periodLabels) as Period[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={`min-h-9 rounded-full px-3 text-xs font-bold transition ${
                period === item
                  ? "bg-app-surface text-app-primary shadow-sm"
                  : "text-app-muted"
              }`}
            >
              {periodLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface-subtle p-4">
          <span className="text-muted text-[10px] font-bold uppercase">
            Custo no período
          </span>
          <b className="mt-1 block text-xl text-app-primary">
            {usd(totals.costMillicents / 1000)}
          </b>
        </div>
        <div className="surface-subtle p-4">
          <span className="text-muted text-[10px] font-bold uppercase">
            Tokens
          </span>
          <b className="mt-1 block text-xl">{compactTokens(totals.tokens)}</b>
        </div>
        <div className="surface-subtle p-4">
          <span className="text-muted text-[10px] font-bold uppercase">
            Gerações
          </span>
          <b className="mt-1 block text-xl">{totals.generations}</b>
          <span className="text-muted text-[10px]">
            {totals.calls} chamadas
          </span>
        </div>
        <div className="surface-subtle p-4">
          <span className="text-muted text-[10px] font-bold uppercase">
            Custo médio
          </span>
          <b className="mt-1 block text-xl">
            {totals.generations
              ? usd(totals.costMillicents / 1000 / totals.generations)
              : usd(0)}
          </b>
          <span className="text-muted text-[10px]">por geração</span>
        </div>
      </div>

      <div className="mt-5 border-t border-app-border pt-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-app-primary" />
          <b className="text-sm">Receita x custo (mês corrente)</b>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="surface-subtle p-4">
            <span className="text-muted text-[10px] font-bold uppercase">
              Receita recorrente
            </span>
            <b className="mt-1 block text-xl text-green-500">
              {monthlyRevenueBrl.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </b>
            <span className="text-muted text-[10px]">
              assinaturas ativas ÷ mês
            </span>
          </div>
          <div className="surface-subtle p-4">
            <span className="text-muted text-[10px] font-bold uppercase">
              Custo de IA
            </span>
            <b className="mt-1 block text-xl text-amber-500">
              {usd(monthCostCents)}
            </b>
            <span className="text-muted text-[10px]">
              desde o dia 1º do mês
            </span>
          </div>
        </div>
        <p className="text-muted mt-2 text-[11px] leading-relaxed">
          Receita em BRL e custo em USD não são subtraídos aqui de propósito:
          converter exigiria uma cotação do dia que o app não busca.
        </p>
      </div>

      <div className="mt-5 border-t border-app-border pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Coins size={16} className="text-app-primary" />
          <b className="text-sm">Teto mensal</b>
        </div>
        <Notice>
          A OpenAI não expõe saldo restante por API. Informe abaixo quanto
          pretende gastar no mês para acompanhar o consumo contra esse limite.
        </Notice>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <Input
              label="Teto mensal (US$)"
              inputMode="decimal"
              placeholder="Ex.: 50"
              value={budgetInput}
              onChange={(event) => setBudgetInput(event.target.value)}
            />
          </div>
          <Button loading={saving} onClick={() => void saveBudget()}>
            <Save size={16} />
            Salvar
          </Button>
        </div>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {saved && !error && (
          <div className="mt-3">
            <Notice tone="success">Teto atualizado.</Notice>
          </div>
        )}
        {budgetCents > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-muted">
                {usd(monthCostCents)} de {usd(budgetCents)}
              </span>
              <b
                className={
                  budgetUsedPercent >= 90
                    ? "text-red-500"
                    : budgetUsedPercent >= 70
                      ? "text-amber-500"
                      : "text-app-primary"
                }
              >
                {budgetUsedPercent.toFixed(1)}%
              </b>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-app-elevated">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetUsedPercent >= 90
                    ? "bg-red-500"
                    : budgetUsedPercent >= 70
                      ? "bg-amber-500"
                      : "bg-app-primary"
                }`}
                style={{ width: `${budgetUsedPercent}%` }}
              />
            </div>
            <p className="text-muted mt-1.5 text-[11px]">
              Restam {usd(remainingCents)} do teto declarado para este mês.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
