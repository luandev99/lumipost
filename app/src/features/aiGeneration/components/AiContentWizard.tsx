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
  uploadMedia,
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
  const brandLogoUrl = useAppSelector((state) => state.brand.profile?.logoUrl);
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
  const [referenceImagePath, setReferenceImagePath] = useState<string>();
  const [referenceMode, setReferenceMode] = useState<"base" | "context">();
  const [referenceFileName, setReferenceFileName] = useState<string>();
  const [uploadingReference, setUploadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState("");
  const [useBrandLogo, setUseBrandLogo] = useState(false);

  const pickReferenceImage = async (file: File) => {
    setReferenceError("");
    setUploadingReference(true);
    try {
      const [uploaded] = await dispatch(uploadMedia([file])).unwrap();
      setReferenceImagePath(uploaded.replace(/^content-uploads\//, ""));
      setReferenceFileName(file.name);
      setReferenceMode("context");
      setUseBrandLogo(false);
    } catch (caught) {
      setReferenceError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível enviar a foto de referência.",
      );
    } finally {
      setUploadingReference(false);
    }
  };
  const removeReferenceImage = () => {
    setReferenceImagePath(undefined);
    setReferenceFileName(undefined);
    setReferenceMode(undefined);
  };
  const toggleBrandLogo = () => {
    setUseBrandLogo((current) => {
      const next = !current;
      if (next) removeReferenceImage();
      return next;
    });
  };

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
      referenceImagePath,
      referenceMode,
      useBrandLogo,
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
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold">
                  Foto de referência (opcional)
                </p>
                {!referenceImagePath ? (
                  <label
                    className={`surface-subtle flex min-h-11 items-center justify-center rounded-xl border border-dashed border-app-border px-3 text-sm font-semibold ${useBrandLogo ? "cursor-not-allowed text-app-muted/50" : "cursor-pointer text-app-muted hover:border-app-primary hover:text-app-primary"}`}
                  >
                    {uploadingReference ? "Enviando…" : "Enviar 1 foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingReference || useBrandLogo}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void pickReferenceImage(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <div className="surface-subtle flex items-center justify-between rounded-xl border border-app-border p-3">
                    <span className="min-w-0 truncate text-sm font-semibold">
                      {referenceFileName}
                    </span>
                    <button
                      type="button"
                      onClick={removeReferenceImage}
                      className="text-muted text-xs font-bold uppercase hover:text-app-primary"
                    >
                      Remover
                    </button>
                  </div>
                )}
                {referenceError && (
                  <p className="mt-2 text-xs text-red-500">{referenceError}</p>
                )}
                {referenceImagePath && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReferenceMode("base")}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${referenceMode === "base" ? "border-app-primary bg-app-soft text-app-primary" : "border-app-border bg-app-surface"}`}
                    >
                      Usar como base visual
                      <span className="text-muted mt-1 block font-normal">
                        A IA edita em cima desta foto.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferenceMode("context")}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${referenceMode === "context" ? "border-app-primary bg-app-soft text-app-primary" : "border-app-border bg-app-surface"}`}
                    >
                      Usar só como referência
                      <span className="text-muted mt-1 block font-normal">
                        A IA cria uma imagem nova inspirada nela.
                      </span>
                    </button>
                  </div>
                )}
                {brandLogoUrl && !referenceImagePath && (
                  <button
                    type="button"
                    onClick={toggleBrandLogo}
                    className={`surface-subtle mt-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${useBrandLogo ? "border-app-primary bg-app-soft" : "border-app-border"}`}
                  >
                    <img
                      src={brandLogoUrl}
                      alt="Logo da marca"
                      className="h-9 w-9 shrink-0 rounded-lg object-contain"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-xs font-semibold ${useBrandLogo ? "text-app-primary" : ""}`}
                      >
                        Usar o logo da marca nesta peça
                      </span>
                      <span className="text-muted mt-0.5 block text-[11px] font-normal">
                        A IA cria a arte do zero e inclui seu logo de forma
                        sutil, sem distorcer.
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${useBrandLogo ? "border-app-primary bg-app-primary text-white" : "border-app-border text-app-muted"}`}
                    >
                      {useBrandLogo ? "Ativo" : "Ativar"}
                    </span>
                  </button>
                )}
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
