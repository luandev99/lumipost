import { useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  CheckCircle2,
  CreditCard,
  Facebook,
  ImagePlus,
  Instagram,
  Link2,
  LogOut,
  Palette,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  Sparkles,
  Unlink,
  UserRound,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { BrandProfile, SocialAccount } from "../../../domain/models";
import {
  useAppDispatch,
  useAppSelector,
} from "../../../presentation/store/hooks";
import {
  analyzeInstagramBrand,
  completeOnboarding,
  connectInstagram,
  disconnectInstagram,
  logoutSession,
  restoreSession,
  uiActions,
  uploadBrandLogo,
  uploadBrandLogomark,
  uploadBrandReferenceImage,
} from "../../../presentation/store/store";
import {
  Badge,
  Button,
  Card,
  Input,
  Notice,
  PageHeader,
  Select,
  Textarea,
} from "../../../presentation/ui";
import { errorMessage } from "../../../presentation/utils/errors";
import identityOptions from "../data/brandIdentityOptions.json";
import {
  IdentityCombobox,
  IdentityMultiCombobox,
} from "../components/IdentityCombobox";

// Lista curta e curada: o modelo de imagem não garante renderizar a fonte
// exata mesmo quando ela é informada no prompt, então a escolha aqui serve
// mais como referência de estilo do que uma promessa de precisão tipográfica
// (aviso repetido na tela, perto dos seletores).
const fontFallbacks: Record<string, string> = {
  Inter: 'Inter, "Segoe UI", Arial, sans-serif',
  Arial: "Arial, sans-serif",
  Verdana: "Verdana, sans-serif",
  "Trebuchet MS": '"Trebuchet MS", sans-serif',
  "Playfair Display": '"Playfair Display", Georgia, serif',
  Georgia: "Georgia, serif",
  "Times New Roman": '"Times New Roman", serif',
  "Courier New": '"Courier New", monospace',
};

const fontFamilyFor = (font: string) => fontFallbacks[font] ?? font;

export function CreditsPage() {
  const navigate = useNavigate();
  const subscription = useAppSelector((state) => state.subscription.current);
  const creditBalance = useAppSelector((state) => state.credits.current);
  const availableCredits = creditBalance?.available ?? subscription?.credits ?? 0;
  const plan = useAppSelector((state) =>
    state.subscription.plans.find((item) => item.id === subscription?.planId),
  );
  const contents = useAppSelector((state) => state.contents.items);
  const generated = contents.filter((item) => item.source === "ai");
  const consumed = generated.reduce(
    (sum, item) =>
      sum +
      (item.format === "carousel"
        ? Math.max(2, item.slideTexts?.length ?? 5) * 5
        : item.format === "video"
          ? 15
          : item.format === "caption"
            ? 2
            : 5),
    0,
  );
  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Créditos e assinatura"
        title={`${availableCredits} créditos disponíveis`}
        description="Veja o consumo da IA e saiba exatamente quando cada crédito é descontado."
        action={
          <Button onClick={() => navigate("/app/assinatura")}>
            <CreditCard size={17} />
            Comprar créditos
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <main className="space-y-5">
          <Card className="overflow-hidden p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone="primary">Plano {plan?.name ?? "ativo"}</Badge>
                <b className="mt-4 block text-5xl text-app-primary">
                  {availableCredits}
                </b>
                <span className="text-muted text-sm">
                  de {plan?.credits ?? 0} créditos do ciclo
                </span>
              </div>
              <Sparkles className="text-app-primary" size={32} />
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-app-elevated">
              <div
                className="h-full rounded-full bg-app-primary"
                style={{
                  width: `${Math.min(100, (availableCredits / Math.max(1, plan?.credits ?? 1)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-muted mt-3 text-xs">
              Renovação em{" "}
              {subscription
                ? format(new Date(subscription.expiresAt), "dd/MM/yyyy")
                : "—"}
              .
            </p>
          </Card>
          <Card className="p-5">
            <p className="eyebrow">Histórico de consumo</p>
            <h2 className="mt-1 text-xl font-bold">Gerações desta sessão</h2>
            <div className="mt-5 space-y-2">
              {generated.length ? (
                generated.map((item) => (
                  <div
                    key={item.id}
                    className="surface-subtle flex min-h-14 items-center gap-3 px-4"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-soft text-app-primary">
                      <Sparkles size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{item.title}</b>
                      <span className="text-muted text-xs">
                        {format(new Date(item.createdAt), "dd/MM 'às' HH:mm")}
                      </span>
                    </div>
                    <b className="text-sm text-app-primary">
                      -
                      {item.format === "carousel"
                        ? Math.max(2, item.slideTexts?.length ?? 5) * 5
                        : item.format === "video"
                          ? 15
                          : item.format === "caption"
                            ? 2
                            : 5}
                    </b>
                  </div>
                ))
              ) : (
                <p className="text-muted py-8 text-center text-sm">
                  Nenhuma geração com IA nesta sessão.
                </p>
              )}
            </div>
          </Card>
        </main>
        <aside className="space-y-5">
          <Card className="p-5">
            <p className="eyebrow">Resumo</p>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Conteúdos por IA</span>
                <b>{generated.length}</b>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Créditos usados</span>
                <b>{consumed}</b>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Plano</span>
                <b>{plan?.name ?? "—"}</b>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-bold">Como funciona</h3>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              A prévia e o planejamento editorial são gratuitos. Os créditos só
              são descontados quando você salva ou agenda o conteúdo gerado.
            </p>
            <div className="mt-4 space-y-2 text-xs">
              <p>
                <b>Post, Story ou capa:</b> 5 créditos
              </p>
              <p>
                <b>Carrossel:</b> 5 por slide
              </p>
              <p>
                <b>Vídeo:</b> 15 créditos
              </p>
              <p>
                <b>Apenas legenda:</b> 2 créditos
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function BrandPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user)!;
  const instagramAccount = useAppSelector((state) =>
    state.socialAccounts.items.find(
      (account) => account.network === "instagram" && account.connected,
    ),
  );
  const base = user.brand!;
  const [brand, setBrand] = useState<BrandProfile>(base);
  const [notice, setNotice] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const patch = (value: Partial<BrandProfile>) =>
    setBrand((current) => ({ ...current, ...value }));

  // Preview local por asset: enquanto o path recém-enviado ainda não foi
  // assinado (só acontece no próximo login/restoreSession), a tela mostra o
  // blob local em vez do path cru — o campo persistido (brand.logoUrl etc.)
  // sempre guarda o path real, nunca a blob URL.
  const [logoPreview, setLogoPreview] = useState<string | undefined>(
    base.logoUrl && /^https?:\/\//.test(base.logoUrl) ? base.logoUrl : undefined,
  );
  const [logomarkPreview, setLogomarkPreview] = useState<string | undefined>(
    base.logomarkUrl && /^https?:\/\//.test(base.logomarkUrl)
      ? base.logomarkUrl
      : undefined,
  );
  const [referencePreviews, setReferencePreviews] = useState<
    Record<string, string>
  >(() => {
    const initial: Record<string, string> = {};
    for (const path of base.referenceImageUrls ?? [])
      if (/^https?:\/\//.test(path)) initial[path] = path;
    return initial;
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogomark, setUploadingLogomark] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [assetError, setAssetError] = useState("");

  const pickLogo = async (file: File) => {
    setAssetError("");
    setUploadingLogo(true);
    setLogoPreview(URL.createObjectURL(file));
    try {
      const path = await dispatch(uploadBrandLogo(file)).unwrap();
      patch({ logoUrl: path });
    } catch (caught) {
      setAssetError(errorMessage(caught, "Não foi possível enviar o logo."));
    } finally {
      setUploadingLogo(false);
    }
  };
  const pickLogomark = async (file: File) => {
    setAssetError("");
    setUploadingLogomark(true);
    setLogomarkPreview(URL.createObjectURL(file));
    try {
      const path = await dispatch(uploadBrandLogomark(file)).unwrap();
      patch({ logomarkUrl: path });
    } catch (caught) {
      setAssetError(errorMessage(caught, "Não foi possível enviar a logomarca."));
    } finally {
      setUploadingLogomark(false);
    }
  };
  const addReferenceImage = async (file: File) => {
    if ((brand.referenceImageUrls ?? []).length >= 5) return;
    setAssetError("");
    setUploadingReference(true);
    try {
      const path = await dispatch(uploadBrandReferenceImage(file)).unwrap();
      setReferencePreviews((current) => ({
        ...current,
        [path]: URL.createObjectURL(file),
      }));
      patch({ referenceImageUrls: [...(brand.referenceImageUrls ?? []), path] });
    } catch (caught) {
      setAssetError(
        errorMessage(caught, "Não foi possível enviar a imagem de referência."),
      );
    } finally {
      setUploadingReference(false);
    }
  };
  const removeReferenceImage = (path: string) =>
    patch({
      referenceImageUrls: (brand.referenceImageUrls ?? []).filter(
        (item) => item !== path,
      ),
    });
  const save = async () => {
    await dispatch(completeOnboarding({ userId: user.id, brand })).unwrap();
    setNotice(
      "Identidade da marca atualizada. As próximas gerações já usarão estas informações.",
    );
  };
  const analyzeInstagram = async () => {
    if (!brand.id || !instagramAccount) {
      setAnalysisError("Conecte uma conta profissional do Instagram antes de analisar a identidade.");
      return;
    }
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const result = await dispatch(
        analyzeInstagramBrand({ brandId: brand.id, socialAccountId: instagramAccount.id }),
      ).unwrap();
      setBrand((current) => ({
        ...current,
        description: result.proposal.description,
        industry: result.proposal.industry,
        specialty: result.proposal.specialty,
        audience: result.proposal.audience,
        personality: result.proposal.personality,
        tone: result.proposal.tone,
        visualStyle: result.proposal.visualStyle,
        primaryColor: result.proposal.primaryColor,
        secondaryColor: result.proposal.secondaryColor,
        headingFont: result.proposal.headingFont,
        bodyFont: result.proposal.bodyFont,
      }));
      await dispatch(restoreSession());
      setNotice(`Identidade preenchida com base no perfil. Confiança da análise: ${Math.round(result.proposal.confidence * 100)}%. Revise os campos antes de continuar.`);
    } catch (caught) {
      setAnalysisError(errorMessage(caught, "Não foi possível analisar o Instagram."));
    } finally {
      setAnalyzing(false);
    }
  };
  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Identidade da marca"
        title="Ensine a IA a falar como você"
        description="Posicionamento, público, voz e visual são aplicados às próximas gerações."
        action={
          <Button
            variant="secondary"
            loading={analyzing}
            disabled={!instagramAccount}
            onClick={() => void analyzeInstagram()}
          >
            <Instagram size={17} />
            Analisar Instagram
          </Button>
        }
      />
      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {analysisError && (
        <div className="mb-4"><Notice tone="error">{analysisError}</Notice></div>
      )}
      {assetError && (
        <div className="mb-4"><Notice tone="error">{assetError}</Notice></div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <main className="space-y-5">
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Palette className="text-app-primary" />
              <h2 className="text-xl font-bold">Essência e posicionamento</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome da marca"
                value={brand.brandName}
                onChange={(event) => patch({ brandName: event.target.value })}
              />
              <Input
                label="Segmento"
                value={brand.industry}
                onChange={(event) => patch({ industry: event.target.value })}
              />
              <Input
                label="Especialidade"
                value={brand.specialty}
                onChange={(event) => patch({ specialty: event.target.value })}
              />
              <IdentityCombobox
                label="Tipo de negócio"
                options={identityOptions.businessTypes}
                value={brand.businessType ?? ""}
                allowCustom
                placeholder="Ex.: Corporativo, Industrial..."
                description="Orienta o tom e o estilo das peças geradas pela IA."
                onChange={(businessType) => patch({ businessType })}
              />
              <Input
                label="Instagram"
                value={brand.instagram}
                onChange={(event) => patch({ instagram: event.target.value })}
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Descrição da marca"
                  value={brand.description}
                  onChange={(event) =>
                    patch({ description: event.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Público-alvo"
                  value={brand.audience}
                  onChange={(event) => patch({ audience: event.target.value })}
                />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <ImagePlus className="text-app-primary" />
              <h2 className="text-xl font-bold">Logo, logomarca e referências</h2>
            </div>
            <p className="text-muted -mt-3 mb-4 text-sm">
              Logo e logomarca são reproduzidos nas peças geradas. As
              referências de estilo ajudam a IA a copiar layout e composição —
              como os exemplos que você já tem em mente.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-sm font-semibold">
                  Logo (símbolo)
                </p>
                <label className="surface-subtle flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-app-border hover:border-app-primary">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo da marca"
                      className="h-full w-full object-contain p-3"
                    />
                  ) : (
                    <span className="text-muted flex flex-col items-center gap-1 text-xs font-semibold">
                      <ImagePlus size={20} />
                      {uploadingLogo ? "Enviando…" : "Enviar logo"}
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void pickLogo(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold">
                  Logomarca (peça completa)
                </p>
                <label className="surface-subtle flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-app-border hover:border-app-primary">
                  {logomarkPreview ? (
                    <img
                      src={logomarkPreview}
                      alt="Logomarca da marca"
                      className="h-full w-full object-contain p-3"
                    />
                  ) : (
                    <span className="text-muted flex flex-col items-center gap-1 text-xs font-semibold">
                      <ImagePlus size={20} />
                      {uploadingLogomark ? "Enviando…" : "Enviar logomarca"}
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploadingLogomark}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void pickLogomark(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex items-end justify-between">
                <p className="text-sm font-semibold">
                  Referências de estilo
                </p>
                <span className="text-muted text-[10px]">
                  {(brand.referenceImageUrls ?? []).length}/5
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {(brand.referenceImageUrls ?? []).map((path) => (
                  <div
                    key={path}
                    className="surface-subtle relative aspect-square overflow-hidden rounded-2xl border border-app-border"
                  >
                    {referencePreviews[path] && (
                      <img
                        src={referencePreviews[path]}
                        alt="Referência de estilo"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeReferenceImage(path)}
                      aria-label="Remover referência"
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {(brand.referenceImageUrls ?? []).length < 5 && (
                  <label className="surface-subtle flex aspect-square cursor-pointer items-center justify-center rounded-2xl border border-dashed border-app-border hover:border-app-primary">
                    <span className="text-muted flex flex-col items-center gap-1 text-[10px] font-semibold">
                      <ImagePlus size={18} />
                      {uploadingReference ? "Enviando…" : "Adicionar"}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      disabled={uploadingReference}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void addReferenceImage(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-5 text-xl font-bold">
              Personalidade e identidade visual
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <IdentityMultiCombobox
                label="Personalidade da marca"
                options={identityOptions.personalities}
                value={brand.personality}
                maxSelected={8}
                description="Escolha até 8 características."
                onChange={(personality) => patch({ personality })}
              />
              <IdentityMultiCombobox
                label="Tom de voz"
                options={identityOptions.tones}
                value={brand.tone}
                maxSelected={6}
                description="Escolha até 6 formas de comunicação."
                onChange={(tone) => patch({ tone })}
              />
              <Input
                label="Cor principal"
                type="color"
                value={brand.primaryColor}
                onChange={(event) =>
                  patch({ primaryColor: event.target.value })
                }
              />
              <Input
                label="Cor secundária"
                type="color"
                value={brand.secondaryColor}
                onChange={(event) =>
                  patch({ secondaryColor: event.target.value })
                }
              />
              <div className="sm:col-span-2">
                <IdentityCombobox
                  label="Estilo visual"
                  options={identityOptions.visualStyles}
                  value={brand.visualStyle}
                  allowCustom
                  description="Pesquise e escolha a direção visual principal da marca."
                  onChange={(visualStyle) => patch({ visualStyle })}
                />
              </div>
              <Select
                label="Fonte dos títulos"
                value={brand.headingFont}
                onChange={(event) => patch({ headingFont: event.target.value })}
              >
                {Object.keys(fontFallbacks).map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </Select>
              <Select
                label="Fonte dos textos"
                value={brand.bodyFont}
                onChange={(event) => patch({ bodyFont: event.target.value })}
              >
                {Object.keys(fontFallbacks).map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </Select>
              <p className="text-muted sm:col-span-2 text-[11px]">
                A IA de imagem não garante renderizar exatamente esta fonte —
                é uma referência para o estilo, não uma promessa de precisão
                tipográfica.
              </p>
            </div>
          </Card>
        </main>
        <aside>
          <Card className="sticky top-24 p-5">
            <p className="eyebrow">Preview da marca</p>
            <div
              className="mt-4 rounded-3xl p-5 text-white"
              style={{
                background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.secondaryColor})`,
              }}
            >
              <b
                className="text-2xl"
                style={{ fontFamily: fontFamilyFor(brand.headingFont) }}
              >
                {brand.brandName}
              </b>
              <p
                className="mt-2 text-sm opacity-85"
                style={{ fontFamily: fontFamilyFor(brand.bodyFont) }}
              >
                {brand.description}
              </p>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <p>
                <b>Público:</b> {brand.audience}
              </p>
              <p>
                <b>Personalidade:</b> {brand.personality.join(", ")}
              </p>
              <p>
                <b>Tom:</b> {brand.tone.join(", ")}
              </p>
              <p>
                <b>Estilo:</b> {brand.visualStyle}
              </p>
              {brand.businessType && (
                <p>
                  <b>Tipo de negócio:</b> {brand.businessType}
                </p>
              )}
              <p>
                <b>Fontes:</b> {brand.headingFont} / {brand.bodyFont}
              </p>
            </div>
            <Button className="mt-5 w-full" onClick={() => void save()}>
              <Save size={17} />
              Salvar identidade
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

const networkIcons = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Link2,
  linkedin: Link2,
};
export function SocialAccountsPage() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const accounts = useAppSelector((state) => state.socialAccounts.items);
  const callbackStatus = new URLSearchParams(location.search).get("instagram");
  const [notice, setNotice] = useState(
    callbackStatus === "success" ? "Instagram conectado e sincronizado com sucesso." : "",
  );
  const [error, setError] = useState(
    callbackStatus === "error" ? "Não foi possível conectar o Instagram. Tente novamente." : "",
  );
  const [loadingId, setLoadingId] = useState<string>();
  const connect = async () => {
    setLoadingId("new");
    setError("");
    try {
      const result = await dispatch(connectInstagram()).unwrap();
      if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
      else throw new Error("O backend não retornou a autorização da Meta.");
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível iniciar a conexão."));
    } finally {
      setLoadingId(undefined);
    }
  };
  const toggle = async (account: SocialAccount) => {
    if (!account.connected) return connect();
    setLoadingId(account.id);
    setError("");
    try {
      await dispatch(disconnectInstagram(account.id)).unwrap();
      setNotice(`${account.displayName} desconectado com segurança.`);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível desconectar a conta."));
    } finally {
      setLoadingId(undefined);
    }
  };
  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Redes sociais"
        title="Contas conectadas"
        description="Escolha onde cada conteúdo será publicado e acompanhe a validade da conexão."
        action={<Button loading={loadingId === "new"} onClick={() => void connect()}><Instagram size={17} />Conectar Instagram</Button>}
      />
      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((account) => {
          const Icon = networkIcons[account.network];
          return (
            <Card key={account.id} className="p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                  {account.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" /> : <Icon size={22} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{account.displayName}</b>
                    <Badge tone={account.connected ? "success" : "neutral"}>
                      {account.connected ? "Conectada" : "Desconectada"}
                    </Badge>
                  </div>
                  <p className="text-muted text-sm">{account.handle}</p>
                </div>
              </div>
              <div className="surface-subtle my-4 p-3 text-xs">
                <span className="text-muted">Permissões</span>
                <p className="mt-1 font-semibold">
                  Publicar mídia, ler perfil e acompanhar status.
                </p>
                {account.expiresAt && (
                  <p className="text-muted mt-1">
                    Sessão válida até{" "}
                    {format(new Date(account.expiresAt), "dd/MM/yyyy")}.
                  </p>
                )}
                {(account.followersCount != null || account.mediaCount != null) && (
                  <p className="text-muted mt-1">
                    {account.followersCount?.toLocaleString("pt-BR") ?? "—"} seguidores · {account.mediaCount ?? "—"} publicações
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant={account.connected ? "secondary" : "primary"}
                  loading={loadingId === account.id}
                  onClick={() => void toggle(account)}
                >
                  {account.connected ? (
                    <Unlink size={16} />
                  ) : (
                    <Link2 size={16} />
                  )}
                  {account.connected ? "Desconectar" : "Conectar"}
                </Button>
                {account.connected && (
                  <button
                    className="icon-button"
                    onClick={() => {
                      void dispatch(restoreSession());
                      setNotice("Dados da conexão atualizados.");
                    }}
                    title="Sincronizar"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {!accounts.length && (
        <Card className="p-10 text-center">
          <Instagram className="mx-auto text-app-primary" size={32} />
          <h2 className="mt-3 font-bold">Nenhuma conta disponível</h2>
          <p className="text-muted mt-1 text-sm">
            Conecte uma conta profissional (Business ou Creator) para analisar a
            identidade e publicar automaticamente.
          </p>
          <Button className="mt-5" loading={loadingId === "new"} onClick={() => void connect()}>
            <Instagram size={17} />Conectar Instagram
          </Button>
        </Card>
      )}
    </div>
  );
}

export function SettingsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user)!;
  const theme = useAppSelector((state) => state.ui.theme);
  const [notifications, setNotifications] = useState(true);
  const [approval, setApproval] = useState(false);
  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Configurações"
        title="Preferências da conta"
        description="Personalize o fluxo da sua equipe e os avisos de publicação."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <main className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <UserRound className="text-app-primary" />
              <div>
                <h2 className="font-bold">Perfil</h2>
                <p className="text-muted text-xs">Dados da sessão atual</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nome" value={user.name} readOnly />
              <Input label="E-mail" value={user.email} readOnly />
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <Settings2 className="text-app-primary" />
              <h2 className="font-bold">Experiência</h2>
            </div>
            <div className="space-y-2">
              <label className="surface-subtle flex min-h-14 cursor-pointer items-center gap-3 px-4">
                <Palette className="text-app-primary" size={18} />
                <span className="flex-1">
                  <b className="block text-sm">Modo escuro</b>
                  <span className="text-muted text-xs">
                    Tema atual: {theme === "dark" ? "escuro" : "claro"}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={theme === "dark"}
                  onChange={() => dispatch(uiActions.toggleTheme())}
                />
              </label>
              <label className="surface-subtle flex min-h-14 cursor-pointer items-center gap-3 px-4">
                <Bell className="text-app-primary" size={18} />
                <span className="flex-1">
                  <b className="block text-sm">Avisar antes de publicar</b>
                  <span className="text-muted text-xs">
                    Lembrete antes do horário agendado
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(event) => setNotifications(event.target.checked)}
                />
              </label>
              <label className="surface-subtle flex min-h-14 cursor-pointer items-center gap-3 px-4">
                <Shield className="text-app-primary" size={18} />
                <span className="flex-1">
                  <b className="block text-sm">Aprovação obrigatória</b>
                  <span className="text-muted text-xs">
                    Pausar novos itens até a revisão
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={approval}
                  onChange={(event) => setApproval(event.target.checked)}
                />
              </label>
            </div>
          </Card>
        </main>
        <aside className="space-y-5">
          <Card className="p-5">
            <p className="eyebrow">Atalhos</p>
            <div className="mt-4 grid gap-2">
              <Button variant="secondary" onClick={() => navigate("/brand")}>
                <Palette size={16} />
                Identidade da marca
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/social-accounts")}
              >
                <Link2 size={16} />
                Redes conectadas
              </Button>
              <Button variant="secondary" onClick={() => navigate("/credits")}>
                <CreditCard size={16} />
                Créditos e plano
              </Button>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-green-500" />
              <b className="text-sm">Sessão protegida</b>
            </div>
            <p className="text-muted mt-2 text-xs leading-relaxed">
              A autenticação é validada pelo Supabase e os dados respeitam as
              políticas de acesso do workspace.
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => {
                void dispatch(logoutSession());
                navigate("/entrar");
              }}
            >
              <LogOut size={16} />
              Sair da conta
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
