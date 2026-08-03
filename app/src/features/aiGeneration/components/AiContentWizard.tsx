import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { ContentFormat } from "../../../domain/models";
import { formatLabels } from "../../../domain/models";
import { AI_VIDEO_GENERATION_ENABLED } from "../../../domain/featureFlags";
import {
  useAppDispatch,
  useAppSelector,
} from "../../../presentation/store/hooks";
import {
  aiGenerationActions,
  previewAiContent,
} from "../../../presentation/store/store";
import {
  Badge,
  Button,
  Input,
  Notice,
  Textarea,
} from "../../../presentation/ui";
import type { PreparedContent } from "../../content/types";
import { GenerationProgress } from "./GenerationProgress";

const objectives = [
  "Vender um produto",
  "Divulgar um serviço",
  "Gerar engajamento",
  "Educar o público",
  "Fortalecer a marca",
  "Mostrar bastidores",
  "Fazer um lançamento",
  "Divulgar uma promoção",
  "Informar uma novidade",
  "Outro objetivo",
];
const suggestions = [
  "Apresentar produto",
  "Mostrar benefício",
  "Responder dúvida frequente",
  "Compartilhar dica",
  "Mostrar bastidores",
  "Depoimento de cliente",
  "Promoção da semana",
];
const formats: ContentFormat[] = [
  "post",
  "carousel",
  "story",
  ...(AI_VIDEO_GENERATION_ENABLED ? (["reel", "video"] as const) : []),
  "caption",
];
const formatDimensions: Record<ContentFormat, string> = {
  post: "1080 × 1080",
  carousel: "1080 × 1350",
  story: "1080 × 1920",
  reel: "1080 × 1920",
  video: "1080 × 1920",
  caption: "Texto",
};
const styles = [
  "Profissional",
  "Elegante",
  "Descontraído",
  "Minimalista",
  "Promocional",
  "Educativo",
  "Inspirador",
  "Divertido",
];

export function AiContentWizard({
  onReady,
  onBack,
}: {
  onReady: (content: PreparedContent) => void;
  onBack: () => void;
}) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user)!;
  const credits = useAppSelector(
    (state) => state.credits.current?.available ?? 0,
  );
  const { drafts, generating, error } = useAppSelector(
    (state) => state.aiGeneration,
  );
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState("Gerar engajamento");
  const [customObjective, setCustomObjective] = useState("");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<ContentFormat>("post");
  const [style, setStyle] = useState("Profissional");
  const [instructions, setInstructions] = useState("");
  const [displayGenerating, setDisplayGenerating] = useState(false);

  const effectiveObjective =
    objective === "Outro objetivo" ? customObjective : objective;
  const estimatedCost =
    format === "carousel"
      ? 25
      : format === "video"
        ? 15
        : format === "caption"
          ? 2
          : 5;
  const canContinue =
    step === 0
      ? Boolean(effectiveObjective.trim())
      : step === 1
        ? Boolean(topic.trim())
        : true;
  const generate = async () => {
    setDisplayGenerating(true);
    dispatch(aiGenerationActions.clearDrafts());
    try {
      await dispatch(
        previewAiContent({
          userId: user.id,
          objective: effectiveObjective,
          topic,
          format,
          style,
          instructions,
          variations: 3,
        }),
      ).unwrap();
    } finally {
      setDisplayGenerating(false);
    }
  };

  const selectDraft = (draft: (typeof drafts)[number]) =>
    onReady({
      source: "ai",
      title: draft.title,
      topic: draft.topic,
      format: draft.format,
      caption: draft.caption,
      hashtags: draft.hashtags,
      cta: draft.cta,
      mediaUrls: [],
      slides: draft.slides,
      slideTexts: draft.slideTexts,
      reelScript: draft.reelScript,
      creditCost: draft.creditCost,
    });

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <button
          className="icon-button"
          onClick={step ? () => setStep((value) => value - 1) : onBack}
          aria-label="Voltar"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-[10px] font-bold uppercase text-app-muted">
            <span>Assistente de IA</span>
            <span>{Math.min(step + 1, 5)} de 5</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-app-elevated">
            <motion.div
              className="h-full rounded-full bg-app-primary"
              animate={{ width: `${((Math.min(step, 4) + 1) / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          {step === 0 && (
            <div>
              <h3 className="text-lg font-bold">
                Qual é o objetivo desta publicação?
              </h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {objectives.map((item) => (
                  <button
                    key={item}
                    onClick={() => setObjective(item)}
                    className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${objective === item ? "border-app-primary bg-app-soft text-app-primary" : "border-app-border bg-app-surface"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {objective === "Outro objetivo" && (
                <div className="mt-3">
                  <Input
                    label="Objetivo personalizado"
                    value={customObjective}
                    onChange={(event) => setCustomObjective(event.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-bold">
                Sobre o que será a publicação?
              </h3>
              <div className="mt-4">
                <Textarea
                  label="Assunto"
                  placeholder="Ex.: divulgar a nova coleção de inverno com foco em qualidade e exclusividade"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    onClick={() => setTopic(item)}
                    className="rounded-full border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold hover:border-app-primary hover:text-app-primary"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h3 className="text-lg font-bold">Escolha o formato</h3>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {formats.map((item) => (
                  <button
                    key={item}
                    onClick={() => setFormat(item)}
                    className={`min-h-24 rounded-2xl border p-3 text-left ${format === item ? "border-app-primary bg-app-soft text-app-primary" : "border-app-border bg-app-surface"}`}
                  >
                    <b className="block text-sm">{formatLabels[item]}</b>
                    <span className="text-muted mt-2 block text-[10px]">
                      {formatDimensions[item]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h3 className="text-lg font-bold">Como deve ser o estilo?</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {styles.map((item) => (
                  <button
                    key={item}
                    onClick={() => setStyle(item)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${style === item ? "border-app-primary bg-app-primary text-white" : "border-app-border bg-app-surface"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <Textarea
                  label="Instruções adicionais (opcional)"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </div>
            </div>
          )}
          {step >= 4 && (
            <div>
              <h3 className="text-lg font-bold">Revise antes de gerar</h3>
              <div className="surface-subtle mt-4 grid gap-3 p-4 sm:grid-cols-2">
                <div>
                  <span className="text-muted text-[10px] font-bold uppercase">
                    Objetivo
                  </span>
                  <b className="block text-sm">{effectiveObjective}</b>
                </div>
                <div>
                  <span className="text-muted text-[10px] font-bold uppercase">
                    Formato
                  </span>
                  <b className="block text-sm">{formatLabels[format]}</b>
                </div>
                <div>
                  <span className="text-muted text-[10px] font-bold uppercase">
                    Variações
                  </span>
                  <b className="block text-sm">3 opções</b>
                </div>
                <div>
                  <span className="text-muted text-[10px] font-bold uppercase">
                    Créditos após escolher
                  </span>
                  <b className="block text-sm text-app-primary">
                    {estimatedCost} créditos
                  </b>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted text-[10px] font-bold uppercase">
                    Saldo
                  </span>
                  <b className="block text-sm">
                    {credits} → {credits - estimatedCost}
                  </b>
                </div>
              </div>
              {error && (
                <div className="mt-3">
                  <Notice tone="error">{error}</Notice>
                </div>
              )}
              {(generating || displayGenerating) && (
                <div className="mt-4">
                  <GenerationProgress />
                </div>
              )}
              {!drafts.length && !generating && !displayGenerating && (
                <Button
                  className="mt-4 w-full"
                  disabled={estimatedCost > credits}
                  onClick={() => void generate()}
                >
                  <WandSparkles size={17} />
                  Gerar 3 opções
                </Button>
              )}
              {drafts.length > 0 && !displayGenerating && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <b>Escolha sua favorita</b>
                    <Badge tone="success">Nenhum crédito consumido ainda</Badge>
                  </div>
                  {drafts.map((draft, index) => (
                    <motion.button
                      key={draft.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      onClick={() => selectDraft(draft)}
                      className="surface-subtle flex w-full items-start gap-3 p-4 text-left hover:border-violet-400"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-soft text-app-primary">
                        <Sparkles size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-sm">{draft.title}</b>
                        <span className="text-muted mt-1 line-clamp-2 block text-xs">
                          {draft.caption}
                        </span>
                      </span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-app-border">
                        <Check size={14} />
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {step < 4 && (
        <div className="mt-6 flex justify-end">
          <Button
            disabled={!canContinue}
            onClick={() => setStep((value) => value + 1)}
          >
            Continuar <ArrowRight size={17} />
          </Button>
        </div>
      )}
    </div>
  );
}
