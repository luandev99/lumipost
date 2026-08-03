import { useMemo, useState } from "react";
import { addDays, format, formatISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  Clock3,
  PencilLine,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { ContentFormat, WeeklySlot } from "../../../domain/models";
import { formatLabels } from "../../../domain/models";
import { AI_VIDEO_GENERATION_ENABLED } from "../../../domain/featureFlags";
import {
  useAppDispatch,
  useAppSelector,
} from "../../../presentation/store/hooks";
import {
  confirmWeek,
  generateWeeklyPlan,
  plannerActions,
} from "../../../presentation/store/store";
import {
  Badge,
  Button,
  Card,
  Input,
  Notice,
  PageHeader,
  Segmented,
  Select,
} from "../../../presentation/ui";
import { errorMessage } from "../../../presentation/utils/errors";
import {
  connectedInstagramAccount,
  INSTAGRAM_REQUIRED_MESSAGE,
} from "../../../presentation/utils/instagramGuard";

type PlanningMode = "automatic" | "custom";
const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const formats: ContentFormat[] = [
  "post",
  "carousel",
  "story",
  ...(AI_VIDEO_GENERATION_ENABLED ? (["reel"] as const) : []),
];
const defaultDays = [0, 1, 2, 3, 4];

export function WeeklyPlanningPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user)!;
  const credits = useAppSelector(
    (state) => state.credits.current?.available ?? 0,
  );
  const generatingPlan = useAppSelector((state) => state.planner.generating);
  const socialAccounts = useAppSelector((state) => state.socialAccounts.items);
  const instagramAccount = connectedInstagramAccount(socialAccounts);
  const [mode, setMode] = useState<PlanningMode>("automatic");
  const [weekStart, setWeekStart] = useState(() =>
    formatISO(startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), {
      representation: "date",
    }),
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(defaultDays);
  const [quantity, setQuantity] = useState(1);
  const [objective, setObjective] = useState(
    "Fortalecer a marca e gerar engajamento",
  );
  const [selectedFormats, setSelectedFormats] =
    useState<ContentFormat[]>(formats);
  const [preferredTime, setPreferredTime] = useState("19:30");
  const [avoidRepeated, setAvoidRepeated] = useState(true);
  const [varyTopics, setVaryTopics] = useState(true);
  const [includeDates, setIncludeDates] = useState(true);
  const [useProducts, setUseProducts] = useState(false);
  const [usePrevious, setUsePrevious] = useState(true);
  const [plan, setPlan] = useState<WeeklySlot[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const monday = useMemo(() => new Date(`${weekStart}T12:00:00`), [weekStart]);
  // Antes da IA sugerir a semana ainda não dá pra saber o mix exato de
  // formatos por dia — estima usando o mesmo custo por formato do backend
  // (costFor em content-generation.ts), com 5 slides como padrão de
  // carrossel, e mostra com "~" pra deixar claro que é aproximado.
  const estimatedCostPerItem = (format: ContentFormat) =>
    format === "caption" ? 2 : format === "carousel" ? 5 * 5 : 5;
  // A IA agora retorna um slot por publicação (não mais um por dia com
  // quantity=N), então plan.length já é o total real depois de gerado.
  const totalItems = plan.length || selectedDays.length * quantity;
  const totalCost = plan.length
    ? plan.reduce((sum, slot) => sum + slot.cost, 0)
    : Math.round(
        (selectedFormats.length
          ? selectedFormats.reduce(
              (sum, format) => sum + estimatedCostPerItem(format),
              0,
            ) / selectedFormats.length
          : 5) * totalItems,
      );

  const generatePlan = async () => {
    setError("");
    setNotice("");
    const [preferredHour, preferredMinute] = preferredTime
      .split(":")
      .map(Number);
    const latestStart = 23 * 60 + 59 - (quantity - 1) * 120;
    const safeMinutes = Math.min(
      preferredHour * 60 + preferredMinute,
      latestStart,
    );
    const safeTime = `${String(Math.floor(safeMinutes / 60)).padStart(2, "0")}:${String(safeMinutes % 60).padStart(2, "0")}`;
    try {
      const next = await dispatch(
        generateWeeklyPlan({
          weekStart,
          selectedDays,
          formats: selectedFormats as Array<
            "post" | "carousel" | "story" | "reel"
          >,
          quantity,
          preferredTime: safeTime,
          objective,
          preferences: {
            avoidRepeated,
            varyTopics,
            includeDates,
            useProducts,
            usePrevious,
          },
        }),
      ).unwrap();
      setPlan(next);
      dispatch(plannerActions.setWeekStart(weekStart));
      setNotice(
        "Plano editorial criado pela IA. Revise assuntos e formatos antes de gerar as mídias.",
      );
      return next;
    } catch (caught) {
      setError(
        errorMessage(caught, "Não foi possível gerar o planejamento com IA."),
      );
      return [];
    }
  };
  const generateContents = async () => {
    if (!instagramAccount) {
      setError(INSTAGRAM_REQUIRED_MESSAGE);
      return;
    }
    const approved = plan.length ? plan : await generatePlan();
    if (!approved.length) return;
    const cost = approved.reduce((sum, slot) => sum + slot.cost, 0);
    if (cost > credits) {
      setError(
        "Seu saldo não cobre este plano. Reduza a quantidade ou escolha menos carrosséis.",
      );
      return;
    }
    setError("");
    setConfirming(true);
    try {
      const result = await dispatch(
        confirmWeek({ userId: user.id, weekStart, slots: approved }),
      ).unwrap();
      navigate(`/planning/${result.planId}`);
    } catch (caught) {
      setError(
        errorMessage(caught, "Não foi possível confirmar o planejamento."),
      );
    } finally {
      setConfirming(false);
    }
  };
  const toggleDay = (index: number) =>
    setSelectedDays((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  const toggleFormat = (value: ContentFormat) =>
    setSelectedFormats((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  const updatePlan = (id: string, patch: Partial<WeeklySlot>) =>
    setPlan((current) =>
      current.map((slot) => {
        if (slot.id !== id) return slot;
        const next = { ...slot, ...patch };
        return {
          ...next,
          cost:
            next.source === "ai"
              ? 5 *
                (next.format === "carousel" ? next.slides : 1) *
                (next.quantity ?? 1)
              : 0,
        };
      }),
    );

  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Planejamento semanal"
        title="Planeje primeiro. Gere depois."
        description="Aprove o plano editorial antes de consumir créditos com artes e vídeos."
      />
      <div className="mb-5 max-w-xl">
        <Segmented
          value={mode}
          onChange={setMode}
          items={[
            { value: "automatic", label: "Planejamento automático" },
            { value: "custom", label: "Montar manualmente" },
          ]}
        />
      </div>
      {!instagramAccount && (
        <div className="mb-4">
          <Notice tone="error">
            {INSTAGRAM_REQUIRED_MESSAGE}{" "}
            <button
              type="button"
              className="font-bold underline underline-offset-2"
              onClick={() => navigate("/social-accounts")}
            >
              Conectar agora
            </button>
          </Notice>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {plan.some((slot) => slot.format === "reel") && (
        <div className="mb-4">
          <Notice>
            Reels gerados por IA nascem como rascunho: o Higgsfield leva
            alguns minutos para renderizar o vídeo. Revise e agende cada um
            manualmente depois que o vídeo estiver pronto.
          </Notice>
        </div>
      )}
      {mode === "automatic" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <main className="space-y-4">
            <Card className="p-5">
              <div className="mb-5 flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-bold">
                    Planejamento automático com IA
                  </h2>
                  <p className="text-muted text-sm">
                    Escolha os dias e deixe o Lumipost montar uma sugestão
                    completa no backend.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Semana"
                  type="date"
                  value={weekStart}
                  min={formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), {
                    representation: "date",
                  })}
                  onChange={(event) => {
                    setWeekStart(
                      formatISO(
                        startOfWeek(
                          new Date(`${event.target.value}T12:00:00`),
                          { weekStartsOn: 1 },
                        ),
                        { representation: "date" },
                      ),
                    );
                    setPlan([]);
                  }}
                />
                <Input
                  label="Publicações por dia"
                  type="number"
                  min={1}
                  max={5}
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(
                      Math.min(5, Math.max(1, Number(event.target.value))),
                    );
                    setPlan([]);
                  }}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Objetivo principal da semana"
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                  />
                </div>
                <Input
                  label="Horário preferido"
                  type="time"
                  value={preferredTime}
                  onChange={(event) => setPreferredTime(event.target.value)}
                />
              </div>
              <div className="mt-5">
                <b className="text-sm">Dias de publicação</b>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {dayLabels.map((label, index) => (
                    <button
                      key={label}
                      onClick={() => {
                        toggleDay(index);
                        setPlan([]);
                      }}
                      className={`min-h-16 rounded-2xl border text-sm font-bold ${selectedDays.includes(index) ? "border-app-primary bg-app-primary text-white" : "border-app-border bg-app-elevated"}`}
                    >
                      {selectedDays.includes(index) && (
                        <Check className="mx-auto mb-1" size={13} />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <b className="text-sm">Formatos desejados</b>
                <div className="mt-2 flex flex-wrap gap-2">
                  {formats.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        toggleFormat(item);
                        setPlan([]);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedFormats.includes(item) ? "border-app-primary bg-app-soft text-app-primary" : "border-app-border bg-app-surface"}`}
                    >
                      {formatLabels[item]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  {
                    label: "Evitar formatos repetidos",
                    value: avoidRepeated,
                    setter: setAvoidRepeated,
                  },
                  {
                    label: "Variar assuntos",
                    value: varyTopics,
                    setter: setVaryTopics,
                  },
                  {
                    label: "Incluir datas comemorativas",
                    value: includeDates,
                    setter: setIncludeDates,
                  },
                  {
                    label: "Usar produtos cadastrados",
                    value: useProducts,
                    setter: setUseProducts,
                  },
                  {
                    label: "Usar conteúdos anteriores como referência",
                    value: usePrevious,
                    setter: setUsePrevious,
                  },
                ].map((option) => (
                  <label
                    key={option.label}
                    className="surface-subtle flex min-h-12 cursor-pointer items-center gap-3 px-4 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={option.value}
                      onChange={(event) => option.setter(event.target.checked)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </Card>
            {plan.length > 0 && (
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Prévia editorial</p>
                    <h2 className="text-xl font-bold">
                      Revise antes de gastar créditos
                    </h2>
                  </div>
                  <Badge tone="success">Plano gratuito</Badge>
                </div>
                <div className="space-y-3">
                  {plan.map((slot, index) => (
                    <motion.div
                      key={slot.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="surface-subtle grid items-center gap-3 p-3 md:grid-cols-[130px_150px_1fr_100px]"
                    >
                      <div>
                        <span className="text-muted block text-[10px] font-bold uppercase">
                          {format(new Date(`${slot.date}T12:00:00`), "EEEE", {
                            locale: ptBR,
                          })}
                        </span>
                        <b className="text-sm">
                          {format(new Date(`${slot.date}T12:00:00`), "dd/MM")}
                        </b>
                      </div>
                      <Select
                        value={slot.format}
                        onChange={(event) =>
                          updatePlan(slot.id, {
                            format: event.target.value as ContentFormat,
                            slides: event.target.value === "carousel" ? 5 : 1,
                          })
                        }
                      >
                        {formats.map((item) => (
                          <option key={item} value={item}>
                            {formatLabels[item]}
                          </option>
                        ))}
                      </Select>
                      <input
                        className="field"
                        value={slot.topic}
                        onChange={(event) =>
                          updatePlan(slot.id, { topic: event.target.value })
                        }
                      />
                      <Input
                        type="time"
                        value={slot.time}
                        onChange={(event) =>
                          updatePlan(slot.id, { time: event.target.value })
                        }
                      />
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </main>
          <aside>
            <Card className="sticky top-24 p-5">
              <p className="eyebrow">Resumo do plano</p>
              <h2 className="mt-1 text-xl font-bold">Sua próxima semana</h2>
              <div className="my-5 space-y-3 border-y border-app-border py-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Dias escolhidos</span>
                  <b>{selectedDays.length}</b>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Total de conteúdos</span>
                  <b>{totalItems}</b>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Custo se aprovado</span>
                  <b className="text-app-primary">
                    {plan.length ? "" : "~"}
                    {totalCost} créditos
                  </b>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Saldo atual</span>
                  <b>{credits}</b>
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  loading={generatingPlan}
                  disabled={
                    !selectedDays.length ||
                    !selectedFormats.length ||
                    generatingPlan ||
                    confirming
                  }
                  onClick={() => void generatePlan()}
                >
                  <PencilLine size={17} />
                  Gerar apenas planejamento
                </Button>
                <Button
                  className="w-full"
                  loading={confirming}
                  disabled={
                    !selectedDays.length ||
                    !selectedFormats.length ||
                    !instagramAccount ||
                    generatingPlan ||
                    confirming
                  }
                  onClick={() => void generateContents()}
                >
                  <WandSparkles size={17} />
                  Gerar planejamento e conteúdos
                </Button>
              </div>
              <p className="text-muted mt-3 text-center text-[11px]">
                O plano usa IA real, mas nenhum crédito é consumido até aprovar
                a criação.
              </p>
            </Card>
          </aside>
        </div>
      ) : (
        <div>
          <Card className="mb-5 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                <CalendarDays size={20} />
              </span>
              <div>
                <h2 className="text-xl font-bold">Montar manualmente</h2>
                <p className="text-muted text-sm">
                  Adicione IA, upload, conteúdo manual ou biblioteca diretamente
                  em cada dia.
                </p>
              </div>
            </div>
          </Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {Array.from({ length: 7 }, (_, index) => {
              const day = addDays(monday, index);
              return (
                <Card key={index} className="p-4">
                  <span className="text-muted text-[10px] font-bold uppercase">
                    {format(day, "EEEE", { locale: ptBR })}
                  </span>
                  <b className="mt-1 block text-xl">{format(day, "dd/MM")}</b>
                  <button
                    onClick={() =>
                      navigate(`/calendar?add=${format(day, "yyyy-MM-dd")}`)
                    }
                    className="surface-subtle mt-4 flex min-h-20 w-full flex-col items-center justify-center border-dashed text-xs font-bold text-app-primary"
                  >
                    <Plus size={17} />
                    Adicionar conteúdo
                  </button>
                </Card>
              );
            })}
          </div>
          <Button className="mt-5" onClick={() => navigate("/calendar")}>
            Abrir calendário completo <Clock3 size={17} />
          </Button>
        </div>
      )}
    </div>
  );
}
