import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { appContainer } from "../../../application/container";
import type { WeeklyPlanProgress } from "../../../domain/repositories";
import { formatAspectRatio, formatLabels } from "../../../domain/models";
import { useAppDispatch } from "../../../presentation/store/hooks";
import {
  fetchWeeklyPlanProgress,
  retryWeeklySlot,
} from "../../../presentation/store/store";
import { Badge, Button, Card, Notice, PageHeader } from "../../../presentation/ui";
import { ContentPreview } from "../../../presentation/components/TemplateRenderer";
import { errorMessage } from "../../../presentation/utils/errors";

const slotStatusLabel: Record<
  WeeklyPlanProgress["slots"][number]["status"],
  string
> = {
  pending: "Na fila",
  processing: "Gerando",
  completed: "Pronto",
  failed: "Falhou",
};

export function WeeklyPlanProgressPage() {
  const { planId } = useParams<{ planId: string }>();
  const dispatch = useAppDispatch();
  const [progress, setProgress] = useState<WeeklyPlanProgress>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState<string>();

  useEffect(() => {
    if (!planId) return;
    let active = true;
    const load = async () => {
      try {
        const next = await dispatch(fetchWeeklyPlanProgress(planId)).unwrap();
        if (active) setProgress(next);
      } catch (caught) {
        if (active)
          setError(errorMessage(caught, "Não foi possível carregar o planejamento."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const unsubscribe = appContainer.subscribeToWeeklyPlanProgress(planId, () => {
      void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [dispatch, planId]);

  if (!planId) return <Navigate to="/planning/new" replace />;

  const retry = async (slotId: string) => {
    setRetryingId(slotId);
    try {
      const next = await dispatch(retryWeeklySlot({ slotId, planId })).unwrap();
      setProgress(next);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível reprocessar este item."));
    } finally {
      setRetryingId(undefined);
    }
  };

  const slots = progress?.slots ?? [];
  const completed = slots.filter((slot) => slot.status === "completed").length;
  const failed = slots.filter((slot) => slot.status === "failed").length;
  const pending = slots.length - completed - failed;

  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Planejamento semanal"
        title={
          progress
            ? `Semana de ${format(new Date(`${progress.weekStart}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}`
            : "Progresso do planejamento"
        }
        description="A geração acontece em background — pode fechar esta página e voltar depois, o progresso continua salvo."
        action={
          <Link to="/calendar" className="btn-secondary">
            <Eye size={16} />
            Ver calendário
          </Link>
        }
      />
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {loading ? (
        <Card className="p-8 text-center text-sm text-app-muted">
          Carregando progresso…
        </Card>
      ) : !progress || !slots.length ? (
        <Card className="p-8 text-center text-sm text-app-muted">
          Planejamento não encontrado.
        </Card>
      ) : (
        <>
          <Card className="mb-5 flex flex-wrap items-center gap-6 p-5">
            <div>
              <span className="text-muted block text-[10px] font-bold uppercase">
                Concluídos
              </span>
              <b className="text-lg text-green-500">{completed} / {slots.length}</b>
            </div>
            {pending > 0 && (
              <div>
                <span className="text-muted block text-[10px] font-bold uppercase">
                  Em andamento
                </span>
                <b className="text-lg text-app-primary">{pending}</b>
              </div>
            )}
            {failed > 0 && (
              <div>
                <span className="text-muted block text-[10px] font-bold uppercase">
                  Falharam
                </span>
                <b className="text-lg text-red-500">{failed}</b>
              </div>
            )}
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {slots.map((slot) => (
              <Card key={slot.id} className="overflow-hidden p-0">
                <div
                  className={`relative flex items-center justify-center overflow-hidden bg-app-elevated ${
                    !slot.content && slot.status !== "failed"
                      ? "generation-preview"
                      : ""
                  }`}
                  style={{ aspectRatio: formatAspectRatio[slot.format] }}
                >
                  {slot.content ? (
                    <Link to={`/content/${slot.content.id}`} className="block h-full w-full">
                      <ContentPreview content={slot.content} width="100%" className="h-full w-full" />
                    </Link>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-2 text-app-muted">
                      {slot.status === "failed" ? (
                        <AlertTriangle className="text-red-500" size={22} />
                      ) : (
                        <Loader2 className="animate-spin" size={22} />
                      )}
                      <span className="text-[11px] font-semibold">
                        {slotStatusLabel[slot.status]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge>{formatLabels[slot.format]}</Badge>
                    <Badge
                      tone={
                        slot.status === "completed"
                          ? "success"
                          : slot.status === "failed"
                            ? "danger"
                            : "primary"
                      }
                    >
                      {slot.status === "completed" && <CheckCircle2 size={12} />}
                      {slotStatusLabel[slot.status]}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-xs font-semibold">{slot.topic}</p>
                  <p className="text-muted mt-1 flex items-center gap-1 text-[10px]">
                    <Clock3 size={11} />
                    {format(new Date(`${slot.date}T12:00:00`), "dd/MM", { locale: ptBR })} · {slot.time}
                  </p>
                  {slot.status === "failed" && (
                    <>
                      {slot.errorCode && (
                        <p className="text-muted mt-2 line-clamp-2 text-[10px]">
                          {slot.errorCode}
                        </p>
                      )}
                      <Button
                        variant="secondary"
                        className="mt-2 w-full"
                        loading={retryingId === slot.id}
                        onClick={() => void retry(slot.id)}
                      >
                        <RefreshCw size={14} />
                        Tentar novamente
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
