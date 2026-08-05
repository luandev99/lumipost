import { useMemo, useState } from "react";
import { addDays, format, formatISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  Save,
  ShieldCheck,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MANUAL_SCHEDULE_CREDIT_COST } from "../../../domain/creditRules";
import {
  useAppDispatch,
  useAppSelector,
} from "../../../presentation/store/hooks";
import {
  createContentItem,
  createSingleContentPlan,
  duplicateContent,
  scheduleContent,
  uploadMedia,
} from "../../../presentation/store/store";
import {
  Badge,
  Button,
  Input,
  Notice,
  Select,
  Textarea,
} from "../../../presentation/ui";
import { errorMessage } from "../../../presentation/utils/errors";
import {
  connectedInstagramAccount,
  INSTAGRAM_REQUIRED_MESSAGE,
} from "../../../presentation/utils/instagramGuard";
import type { PreparedContent } from "../../content/types";
import { InstagramPreview } from "../../content/components/InstagramPreview";
import {
  ContentFormatBadge,
  ContentSourceBadge,
} from "../../content/components/ContentBadges";

export function ScheduleDrawer({
  content,
  defaultDate,
  onBack,
  onComplete,
}: {
  content: PreparedContent;
  defaultDate?: string;
  onBack: () => void;
  onComplete: (contentId: string, scheduled: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user)!;
  const availableCredits = useAppSelector(
    (state) => state.credits.current?.available ?? 0,
  );
  const accounts = useAppSelector((state) => state.socialAccounts.items).filter(
    (account) => account.connected,
  );
  const tomorrow = formatISO(addDays(new Date(), 1)).slice(0, 10);
  const [step, setStep] = useState<"schedule" | "review">("schedule");
  const [scheduledAt, setScheduledAt] = useState(
    `${defaultDate || tomorrow}T19:30`,
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [firstComment, setFirstComment] = useState(content.firstComment ?? "");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [notifyBefore, setNotifyBefore] = useState(true);
  const [crossPost, setCrossPost] = useState(false);
  const [repeat, setRepeat] = useState("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const instagramAccount = connectedInstagramAccount(accounts);
  // Reel/vídeo por IA nunca agenda direto: o Higgsfield gera de forma
  // assíncrona e o vídeo real precisa ser revisado antes de ir ao ar. Tentar
  // agendar aqui bateria sempre no guard VIDEO_UPLOAD_REQUIRED do backend.
  const aiVideoNeedsDraftOnly =
    content.source === "ai" &&
    (content.format === "reel" || content.format === "video");
  const dateLabel = useMemo(() => {
    const date = new Date(scheduledAt);
    return Number.isNaN(date.getTime())
      ? "data escolhida"
      : format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  }, [scheduledAt]);
  // Conteúdo de IA não cobra a taxa de agendamento manual: a geração e o
  // agendamento (quando aplicável) acontecem juntos, no mesmo worker em
  // background — mesma regra já usada no planejamento semanal.
  const totalCreditCost =
    content.source === "ai"
      ? content.creditCost
      : content.creditCost + MANUAL_SCHEDULE_CREDIT_COST;
  const afterCredits = Math.max(
    0,
    availableCredits - totalCreditCost,
  );
  const insufficientCredits = availableCredits < totalCreditCost;

  // Conteúdo de IA não é gerado aqui: fica pendente e o worker em background
  // (o mesmo do planejamento semanal) gera de fato. Navegamos para a tela de
  // progresso, que sobrevive a F5/fechar a aba.
  const startBackgroundGeneration = async (scheduled: boolean) => {
    const [date, time] = scheduledAt.split("T");
    const result = await dispatch(
      createSingleContentPlan({
        userId: user.id,
        date,
        time,
        scheduled,
        format: content.format,
        topic: content.topic,
        slides: content.slides ?? 1,
        cost: content.creditCost,
        socialAccountId: scheduled ? accountId : undefined,
        title: content.title,
        caption: content.caption,
        hashtags: content.hashtags,
        cta: content.cta,
        slideTexts: content.slideTexts,
        reelScript: content.reelScript,
        referenceImagePath: content.referenceImagePath,
        referenceMode: content.referenceMode,
      }),
    ).unwrap();
    navigate(`/planning/${result.planId}`);
  };

  const materialize = async () => {
    if (content.source === "ai")
      throw new Error("Conteúdo de IA usa o fluxo em background.");
    if (content.existingId) {
      if (content.duplicateBeforeSchedule)
        return (
          await dispatch(
            duplicateContent({ id: content.existingId, userId: user.id }),
          ).unwrap()
        ).id;
      return content.existingId;
    }
    const mediaUrls = content.mediaFiles?.length
      ? await dispatch(uploadMedia(content.mediaFiles)).unwrap()
      : content.mediaUrls;
    return (
      await dispatch(
        createContentItem({
          userId: user.id,
          title: content.title,
          format: content.format,
          source: content.source === "reused" ? "library" : content.source,
          topic: content.topic,
          caption: content.caption,
          hashtags: content.hashtags,
          cta: content.cta,
          mediaUrls,
          slideTexts: content.slideTexts,
          altText: content.altText,
          location: content.location,
          link: content.link,
          firstComment,
          collaborators: content.collaborators,
          taggedPeople: content.taggedPeople,
          socialAccountIds: [accountId],
        }),
      ).unwrap()
    ).id;
  };

  const saveDraft = async () => {
    setError("");
    setSubmitting(true);
    try {
      if (content.source === "ai") {
        await startBackgroundGeneration(false);
        return;
      }
      const id = await materialize();
      onComplete(id, false);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível salvar o rascunho."));
    } finally {
      setSubmitting(false);
    }
  };
  const confirm = async () => {
    setError("");
    if (!instagramAccount || !accountId) {
      setError(INSTAGRAM_REQUIRED_MESSAGE);
      return;
    }
    if (new Date(scheduledAt).getTime() < Date.now() + 60 * 60 * 1000) {
      setError(
        "Escolha um horário com pelo menos 1 hora de antecedência a partir de agora.",
      );
      return;
    }
    if (insufficientCredits) {
      setError(
        `Saldo insuficiente. A geração e o agendamento precisam de ${totalCreditCost} créditos.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      if (content.source === "ai") {
        await startBackgroundGeneration(true);
        return;
      }
      const id = await materialize();
      await dispatch(
        scheduleContent({
          userId: user.id,
          contentId: id,
          scheduledAt: new Date(scheduledAt).toISOString(),
          options: {
            timezone,
            socialAccountId: accountId,
            approvalRequired,
            notifyBefore,
            firstComment,
          },
        }),
      ).unwrap();
      onComplete(id, true);
    } catch (caught) {
      setError(
        errorMessage(caught, "Não foi possível concluir o agendamento."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <button
          className="icon-button"
          onClick={step === "review" ? () => setStep("schedule") : onBack}
          aria-label="Voltar"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="eyebrow">
            {step === "review" ? "Etapa final" : "Agendamento"}
          </p>
          <h3 className="font-bold">
            {step === "review"
              ? "Revisar publicação"
              : "Quando deseja publicar?"}
          </h3>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
        >
          {step === "schedule" ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="space-y-4">
                {!instagramAccount && (
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
                )}
                <Select
                  label="Conta ou rede social"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {accounts.length ? (
                    accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName} · {account.handle}
                      </option>
                    ))
                  ) : (
                    <option value="">Conecte uma conta do Instagram</option>
                  )}
                </Select>
                <Input
                  label="Data e horário"
                  type="datetime-local"
                  min={formatISO(new Date(Date.now() + 60 * 60 * 1000)).slice(0, 16)}
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
                <p className="text-muted -mt-2 text-[11px]">
                  Agendamento manual só pode ser marcado a partir de 1 hora a
                  partir de agora.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Fuso horário"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  >
                    <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                    <option value="America/Manaus">Manaus (GMT-4)</option>
                    <option value="Europe/Lisbon">Lisboa</option>
                  </Select>
                  <Select
                    label="Repetir publicação"
                    value={repeat}
                    onChange={(event) => setRepeat(event.target.value)}
                  >
                    <option value="none">Não repetir</option>
                    <option value="weekly">Semanalmente</option>
                    <option value="monthly">Mensalmente</option>
                  </Select>
                </div>
                <Textarea
                  label="Primeiro comentário"
                  value={firstComment}
                  onChange={(event) => setFirstComment(event.target.value)}
                />
                <div className="space-y-2">
                  <label className="surface-subtle flex min-h-12 cursor-pointer items-center gap-3 px-4">
                    <input
                      type="checkbox"
                      checked={crossPost}
                      onChange={(event) => setCrossPost(event.target.checked)}
                    />
                    <span className="flex-1 text-sm font-semibold">
                      Publicar também em outras redes
                    </span>
                  </label>
                  <label className="surface-subtle flex min-h-12 cursor-pointer items-center gap-3 px-4">
                    <input
                      type="checkbox"
                      checked={approvalRequired}
                      onChange={(event) =>
                        setApprovalRequired(event.target.checked)
                      }
                    />
                    <ShieldCheck className="text-app-primary" size={17} />
                    <span className="flex-1 text-sm font-semibold">
                      Exigir aprovação antes de publicar
                    </span>
                  </label>
                  <label className="surface-subtle flex min-h-12 cursor-pointer items-center gap-3 px-4">
                    <input
                      type="checkbox"
                      checked={notifyBefore}
                      onChange={(event) =>
                        setNotifyBefore(event.target.checked)
                      }
                    />
                    <Bell className="text-app-primary" size={17} />
                    <span className="flex-1 text-sm font-semibold">
                      Notificar antes da publicação
                    </span>
                  </label>
                </div>
                <Button className="w-full" onClick={() => setStep("review")}>
                  <CalendarCheck size={17} />
                  Revisar agendamento
                </Button>
              </div>
              <aside className="space-y-3">
                <div className="surface-subtle p-4">
                  <p className="eyebrow mb-2">Sugestão</p>
                  <b className="block text-sm">Melhor horário: 19:30</b>
                  <p className="text-muted mt-1 text-xs">
                    Seu público costuma estar mais ativo entre 18:00 e 21:00.
                  </p>
                </div>
                <div className="surface-subtle p-4">
                  <div className="flex items-center gap-2">
                    <Clock3 className="text-app-primary" size={17} />
                    <b className="text-sm">{dateLabel}</b>
                  </div>
                  <p className="text-muted mt-2 text-xs">
                    {selectedAccount?.handle ?? "Instagram não conectado"} ·{" "}
                    {timezone}
                  </p>
                </div>
                <div className="surface-subtle p-4">
                  <span className="text-muted text-[10px] font-bold uppercase">
                    Custo do agendamento
                  </span>
                  <b className="mt-1 block text-lg text-app-primary">
                    {MANUAL_SCHEDULE_CREDIT_COST} créditos
                  </b>
                  <p className="text-muted mt-1 text-xs">
                    Cobrado somente ao confirmar.
                  </p>
                </div>
              </aside>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              {content.format === "reel" || content.format === "video" ? (
                <div className="surface-subtle space-y-4 p-5">
                  <div>
                    <p className="eyebrow mb-2">
                      Roteiro gerado pela IA · {content.reelScript?.duration ?? 24}s
                    </p>
                    <p className="text-sm font-semibold leading-relaxed">
                      Hook: {content.reelScript?.hook || content.title}
                    </p>
                  </div>
                  <ol className="space-y-3">
                    {(content.reelScript?.scenes ?? []).map((scene, index) => (
                      <li key={`${index}-${scene.title}`} className="flex gap-3 text-sm">
                        <span className="text-app-primary font-bold">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <b className="block">{scene.title}</b>
                          <span className="text-muted">{scene.narration}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-muted text-xs">
                    A imagem/vídeo ainda não foi gerado — isso acontece ao
                    salvar o rascunho ou confirmar o agendamento.
                  </p>
                </div>
              ) : content.format === "carousel" ? (
                <div className="surface-subtle space-y-4 p-5">
                  <p className="eyebrow mb-1">
                    Conteúdo gerado pela IA · {content.slides} slides
                  </p>
                  <p className="text-sm font-semibold">{content.title}</p>
                  <ol className="space-y-3">
                    {(content.slideTexts?.length
                      ? content.slideTexts
                      : Array.from({ length: content.slides ?? 1 }, () => "")
                    ).map((text, index) => (
                      <li key={index} className="flex gap-3 text-sm">
                        <span className="text-app-primary font-bold">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{text || `Slide ${index + 1}`}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-muted text-xs">
                    As imagens ainda não foram geradas — isso acontece ao
                    salvar o rascunho ou confirmar o agendamento.
                  </p>
                </div>
              ) : (
                <InstagramPreview
                  content={content}
                  mode={content.format === "story" ? "story" : "feed"}
                  handle={instagramAccount?.handle}
                  avatarUrl={instagramAccount?.avatarUrl}
                />
              )}
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <ContentFormatBadge format={content.format} />
                  <ContentSourceBadge source={content.source} />
                  {content.creditCost > 0 && (
                    <Badge tone="primary">Geração: {content.creditCost}</Badge>
                  )}
                  <Badge tone="neutral">
                    Agendamento: {MANUAL_SCHEDULE_CREDIT_COST}
                  </Badge>
                </div>
                <h3 className="text-xl font-bold">{content.title}</h3>
                <p className="text-muted mt-3 text-sm leading-relaxed">
                  {content.caption}
                </p>
                <div className="surface-subtle mt-5 space-y-3 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Publicação</span>
                    <b>{dateLabel}</b>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Conta</span>
                    <b>
                      {selectedAccount?.handle ?? "Instagram não conectado"}
                    </b>
                  </div>
                  {content.creditCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Criação com IA</span>
                      <b>{content.creditCost} créditos</b>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Agendamento manual</span>
                    <b>{MANUAL_SCHEDULE_CREDIT_COST} créditos</b>
                  </div>
                  <div className="flex justify-between border-t border-app-border pt-3 text-sm">
                    <span className="font-semibold">Total ao confirmar</span>
                    <b className="text-app-primary">
                      {totalCreditCost} créditos
                    </b>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Saldo restante</span>
                    <b className={insufficientCredits ? "text-red-500" : ""}>
                      {afterCredits}
                    </b>
                  </div>
                  {approvalRequired && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Aprovação</span>
                      <b className="text-amber-500">Obrigatória</b>
                    </div>
                  )}
                </div>
                {aiVideoNeedsDraftOnly ? (
                  <Notice>
                    Vídeos gerados por IA nascem como rascunho: o Higgsfield
                    leva alguns minutos para renderizar. Agende manualmente
                    depois de revisar o vídeo pronto.
                  </Notice>
                ) : (
                  <Notice>
                    O agendamento manual custa {MANUAL_SCHEDULE_CREDIT_COST}{" "}
                    créditos. O desconto acontece somente ao confirmar.
                  </Notice>
                )}
                {error && (
                  <div className="mt-3">
                    <Notice tone="error">{error}</Notice>
                  </div>
                )}
                {insufficientCredits && (
                  <Button
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => navigate("/credits")}
                  >
                    <CreditCard size={16} />
                    Comprar créditos
                  </Button>
                )}
                <div
                  className={`mt-5 grid gap-2 ${aiVideoNeedsDraftOnly ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
                >
                  <Button
                    variant="secondary"
                    onClick={() => setStep("schedule")}
                  >
                    <ArrowLeft size={16} />
                    Voltar e editar
                  </Button>
                  <Button
                    variant="secondary"
                    loading={submitting}
                    onClick={() => void saveDraft()}
                  >
                    <Save size={16} />
                    Salvar rascunho
                  </Button>
                  {!aiVideoNeedsDraftOnly && (
                    <Button
                      loading={submitting}
                      disabled={insufficientCredits || !instagramAccount}
                      onClick={() => void confirm()}
                    >
                      <CheckCircle2 size={16} />
                      Agendar para {dateLabel}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
