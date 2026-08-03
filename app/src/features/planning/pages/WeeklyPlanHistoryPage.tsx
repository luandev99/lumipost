import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../presentation/store/hooks";
import { fetchWeeklyPlanSummaries } from "../../../presentation/store/store";
import type { WeeklyPlanSummary } from "../../../domain/repositories";
import { Badge, Card, PageHeader } from "../../../presentation/ui";

const statusFor = (plan: WeeklyPlanSummary) => {
  if (plan.pending > 0)
    return { label: "Em andamento", tone: "primary" as const };
  if (plan.failed > 0 && plan.completed === 0)
    return { label: "Falhou", tone: "danger" as const };
  if (plan.failed > 0)
    return { label: "Concluído com falhas", tone: "warning" as const };
  return { label: "Concluído", tone: "success" as const };
};

export function WeeklyPlanHistoryPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user)!;
  const [plans, setPlans] = useState<WeeklyPlanSummary[]>();

  useEffect(() => {
    dispatch(fetchWeeklyPlanSummaries(user.id))
      .unwrap()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [dispatch, user.id]);

  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Planejamento semanal"
        title="Histórico de planejamentos"
        description="Toda semana planejada com IA fica registrada aqui, mesmo depois de concluída."
      />
      {!plans ? (
        <Card className="p-8 text-center text-sm text-app-muted">
          Carregando histórico…
        </Card>
      ) : !plans.length ? (
        <Card className="p-8 text-center text-sm text-app-muted">
          Nenhum planejamento ainda.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const status = statusFor(plan);
            return (
              <Link
                key={plan.planId}
                to={`/planning/${plan.planId}`}
                className="surface-subtle flex flex-col gap-3 p-4 hover:border-violet-400"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <CalendarClock size={16} className="text-app-primary" />
                    Semana de{" "}
                    {format(new Date(`${plan.weekStart}T12:00:00`), "dd 'de' MMMM", {
                      locale: ptBR,
                    })}
                  </span>
                  <ChevronRight size={16} className="text-app-muted" />
                </div>
                <div className="flex items-center justify-between">
                  <Badge tone={status.tone}>
                    {status.label === "Em andamento" && (
                      <Loader2 className="animate-spin" size={12} />
                    )}
                    {status.label === "Concluído" && <CheckCircle2 size={12} />}
                    {status.label}
                  </Badge>
                  <span className="text-muted text-xs">
                    {plan.completed + plan.failed}/{plan.total} processados
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
