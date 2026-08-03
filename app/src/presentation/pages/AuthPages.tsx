import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Instagram,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import type { BrandProfile, ContentFormat } from "../../domain/models";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  completeOnboarding,
  connectInstagram,
  login,
  loginWithGoogle,
  register,
  restoreSession,
} from "../store/store";
import { Button, Card, Input, Notice, Select, Textarea } from "../ui";
import { errorMessage } from "../utils/errors";

const errorText = (error: unknown) =>
  errorMessage(error, "Algo deu errado. Tente novamente.");

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.auth.loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await dispatch(login({ email, password })).unwrap();
      if (result.user.role === "admin") navigate("/admin");
      else if (!result.user.onboardingCompleted) navigate("/onboarding");
      else if (!result.subscription) navigate("/assinar");
      else navigate("/app/planejar");
    } catch (caught) {
      setError(errorText(caught));
    }
  };
  const google = async () => {
    setError("");
    try {
      await dispatch(loginWithGoogle()).unwrap();
    } catch (caught) {
      setError(errorText(caught));
    }
  };
  return (
    <Card className="p-5 sm:p-7">
      <div className="mb-6 text-center">
        <p className="eyebrow mb-2">Bem-vindo de volta</p>
        <h1 className="text-2xl font-bold">Entre para criar sua semana</h1>
        <p className="text-muted mt-1.5 text-sm">
          Conteúdo bonito, consistente e no horário.
        </p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          required
        />
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button className="w-full" type="submit" loading={loading}>
          Entrar <ArrowRight size={17} />
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-app-muted">
        <span className="h-px flex-1 bg-app-border" />
        ou continue com
        <span className="h-px flex-1 bg-app-border" />
      </div>
      <Button className="w-full" variant="secondary" onClick={() => void google()}>
        <GoogleMark /> Entrar com Google
      </Button>
      <p className="text-muted mt-6 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link className="font-bold text-app-primary" to="/registrar">
          Criar conta
        </Link>
      </p>
    </Card>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.3c1.9-1.8 2.9-4.4 2.9-7.7Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.7c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.8A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 13.8A6 6 0 0 1 6.2 12c0-.6.1-1.2.3-1.8V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.2 1.1 4.6l3.4-2.8Z" />
      <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.4l3.4 2.8A5.9 5.9 0 0 1 12 6.1Z" />
    </svg>
  );
}

export function OAuthCallbackPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void dispatch(restoreSession())
      .unwrap()
      .then((result) => {
        if (!active || !result?.user) throw new Error("Não foi possível concluir o login com Google.");
        if (result.user.role === "admin") navigate("/admin", { replace: true });
        else if (!result.user.onboardingCompleted) navigate("/onboarding", { replace: true });
        else if (!result.subscription) navigate("/assinar", { replace: true });
        else navigate("/dashboard", { replace: true });
      })
      .catch((caught) => active && setError(errorText(caught)));
    return () => { active = false; };
  }, [dispatch, navigate]);

  return (
    <Card className="p-7 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
        <ShieldCheck size={24} />
      </span>
      <h1 className="mt-5 text-xl font-bold">Concluindo login seguro</h1>
      <p className="text-muted mt-2 text-sm">Validando sua sessão diretamente com o Supabase.</p>
      {error ? <div className="mt-5"><Notice tone="error">{error}</Notice><Button className="mt-4" onClick={() => navigate("/entrar", { replace: true })}>Voltar ao login</Button></div> : <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-app-border border-t-app-primary" />}
    </Card>
  );
}

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password.length < 8)
      return setError("A senha deve ter pelo menos 8 caracteres.");
    if (form.password !== form.confirm)
      return setError("As senhas não coincidem.");
    if (!form.terms) return setError("Aceite os termos para continuar.");
    setLoading(true);
    setError("");
    try {
      await dispatch(
        register({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      ).unwrap();
      navigate("/onboarding");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className="p-5 sm:p-7">
      <div className="mb-6 text-center">
        <p className="eyebrow mb-2">Comece grátis</p>
        <h1 className="text-2xl font-bold">Crie sua conta</h1>
        <p className="text-muted mt-1.5 text-sm">
          Sua conta e seus conteúdos ficam protegidos no Supabase.
        </p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <Input
          label="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          label="Senha"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Mínimo de 8 caracteres"
          required
        />
        <Input
          label="Confirmar senha"
          type="password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          required
        />
        <label className="flex items-start gap-3 text-sm text-app-muted">
          <input
            className="mt-1 accent-violet-600"
            type="checkbox"
            checked={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.checked })}
          />
          <span>Li e aceito os termos e a política de privacidade.</span>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" className="w-full" loading={loading}>
          Criar conta <ArrowRight size={17} />
        </Button>
      </form>
      <p className="text-muted mt-6 text-center text-sm">
        <Link className="font-bold text-app-primary" to="/entrar">
          Já tenho uma conta
        </Link>
      </p>
    </Card>
  );
}

const defaultBrand: BrandProfile = {
  brandName: "",
  description: "",
  industry: "Marketing",
  specialty: "",
  audience: "",
  goals: [],
  contentTypes: ["post", "carousel"],
  personality: [],
  tone: [],
  primaryColor: "#7C3AED",
  secondaryColor: "#F2EAFE",
  headingFont: "Playfair Display",
  bodyFont: "Inter",
  visualStyle: "Elegante",
  instagram: "",
  instagramConnected: false,
};
const multiOptions = {
  goals: [
    "Gerar autoridade",
    "Vender mais",
    "Criar comunidade",
    "Educar o público",
  ],
  personality: ["Elegante", "Próxima", "Criativa", "Confiável"],
  tone: ["Inspirador", "Direto", "Acolhedor", "Educativo"],
};
function ChoiceGrid({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const selected = values.includes(option);
        return (
          <button
            type="button"
            key={option}
            onClick={() =>
              onChange(
                selected
                  ? values.filter((item) => item !== option)
                  : [...values, option],
              )
            }
            className={`min-h-12 rounded-2xl border px-3 text-sm font-semibold transition ${selected ? "border-violet-400 bg-app-soft text-app-primary" : "border-app-border bg-app-surface text-app-muted"}`}
          >
            {selected && <Check size={15} className="mr-1 inline" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

const ONBOARDING_STEP_KEY = "lumipost:onboarding:step";

export function OnboardingPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const socialAccounts = useAppSelector((state) => state.socialAccounts.items);
  const instagramAccount = socialAccounts.find(
    (account) => account.network === "instagram" && account.connected,
  );
  const [step, setStep] = useState(() => {
    const stored = Number(sessionStorage.getItem(ONBOARDING_STEP_KEY));
    return Number.isFinite(stored) && stored >= 0 && stored <= 5 ? stored : 0;
  });
  const [brand, setBrand] = useState<BrandProfile>({
    ...defaultBrand,
    brandName: user?.name ? `Marca de ${user.name.split(" ")[0]}` : "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const steps = [
    "Instagram",
    "Sua marca",
    "Seu público",
    "Objetivos",
    "Personalidade",
    "Visual",
  ];
  useEffect(() => {
    sessionStorage.setItem(ONBOARDING_STEP_KEY, String(step));
  }, [step]);
  useEffect(() => {
    const instagramStatus = new URLSearchParams(location.search).get(
      "instagram",
    );
    if (!instagramStatus) return;
    if (instagramStatus === "success") {
      setMessage("Instagram conectado com sucesso.");
      void dispatch(restoreSession());
    } else {
      setError(
        "Não foi possível conectar o Instagram. Tente novamente.",
      );
    }
    navigate("/onboarding", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const valid = () => {
    if (step === 1 && (!brand.brandName || !brand.description))
      return "Conte o nome e o que sua marca faz.";
    if (step === 2 && !brand.audience) return "Descreva seu público.";
    if (step === 3 && (!brand.goals.length || !brand.contentTypes.length))
      return "Escolha objetivos e formatos.";
    if (step === 4 && (!brand.personality.length || !brand.tone.length))
      return "Escolha personalidade e tom.";
    return "";
  };
  const next = () => {
    const problem = valid();
    if (problem) return setError(problem);
    setError("");
    setStep((value) => Math.min(5, value + 1));
  };
  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await dispatch(completeOnboarding({ userId: user.id, brand })).unwrap();
      sessionStorage.removeItem(ONBOARDING_STEP_KEY);
      navigate("/assinar");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  };
  const startInstagramConnection = async () => {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const { authorizationUrl } = await dispatch(
        connectInstagram("/onboarding"),
      ).unwrap();
      if (!authorizationUrl) throw new Error("A conexão com o Instagram não está disponível.");
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(errorText(caught));
      setSaving(false);
    }
  };
  return (
    <div className="mx-auto w-full max-w-2xl animate-fade-up">
      <div className="mb-6">
        <div className="mb-3 flex justify-between text-xs font-bold text-app-muted">
          <span>Perfil da marca</span>
          <span>{step + 1} de 6</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-app-elevated">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-700 transition-all"
            style={{ width: `${((step + 1) / 6) * 100}%` }}
          />
        </div>
        <div className="mt-3 hidden grid-cols-6 gap-1 text-center text-[10px] font-semibold text-app-muted sm:grid">
          {steps.map((item, index) => (
            <span
              key={item}
              className={index === step ? "text-app-primary" : ""}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <Card className="p-5 sm:p-8">
        <p className="eyebrow mb-2">{steps[step]}</p>
        {message && (
          <div className="mb-4">
            <Notice tone="success">{message}</Notice>
          </div>
        )}
        {step === 0 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-bold">Conecte seu Instagram</h1>
            <div className="surface-subtle flex items-center gap-4 p-4">
              <Instagram className="text-app-primary" />
              <div className="flex-1">
                <b className="block text-sm">Conexão oficial da Meta</b>
                <p className="text-muted mt-1 text-xs">Você entrará no Instagram para autorizar uma conta profissional. A Lumipost não recebe nem armazena sua senha.</p>
              </div>
            </div>
            {instagramAccount ? (
              <div className="flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm font-bold text-green-500">
                <Check size={17} />
                Conectado como @{instagramAccount.handle}
              </div>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void startInstagramConnection()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-app-border bg-app-surface text-sm font-bold text-app-primary disabled:opacity-60"
              >
                <Instagram size={17} />
                {saving ? "Preparando conexão…" : "Conectar com Instagram"}
              </button>
            )}
            <Notice>
              Você pode concluir sem conectar agora, mas uma conta profissional será necessária antes de agendar publicações.
            </Notice>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Vamos conhecer sua marca</h1>
            <Input
              label="Nome da marca"
              value={brand.brandName}
              onChange={(e) =>
                setBrand({ ...brand, brandName: e.target.value })
              }
            />
            <Textarea
              label="O que sua empresa faz?"
              value={brand.description}
              onChange={(e) =>
                setBrand({ ...brand, description: e.target.value })
              }
            />
            <Select
              label="Segmento"
              value={brand.industry}
              onChange={(e) => setBrand({ ...brand, industry: e.target.value })}
            >
              <option>Marketing</option>
              <option>Alimentação</option>
              <option>Imobiliário</option>
              <option>Jurídico</option>
              <option>Saúde</option>
              <option>Tecnologia</option>
            </Select>
            <Input
              label="Especialidade"
              value={brand.specialty}
              onChange={(e) =>
                setBrand({ ...brand, specialty: e.target.value })
              }
            />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Para quem você cria?</h1>
            <Textarea
              label="Público-alvo"
              placeholder="Ex: empreendedoras criativas de 25 a 45 anos..."
              value={brand.audience}
              onChange={(e) => setBrand({ ...brand, audience: e.target.value })}
            />
            <p className="text-muted text-sm">
              A IA usará esta descrição para ajustar exemplos, linguagem e
              chamadas.
            </p>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-bold">O que quer alcançar?</h1>
            <ChoiceGrid
              values={brand.goals}
              options={multiOptions.goals}
              onChange={(goals) => setBrand({ ...brand, goals })}
            />
            <div>
              <p className="mb-2 text-sm font-semibold">Formatos desejados</p>
              <ChoiceGrid
                values={brand.contentTypes}
                options={["post", "carousel", "story", "reel"]}
                onChange={(contentTypes) =>
                  setBrand({
                    ...brand,
                    contentTypes: contentTypes as ContentFormat[],
                  })
                }
              />
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-bold">Como sua marca se expressa?</h1>
            <div>
              <p className="mb-2 text-sm font-semibold">Personalidade</p>
              <ChoiceGrid
                values={brand.personality}
                options={multiOptions.personality}
                onChange={(personality) => setBrand({ ...brand, personality })}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Tom de voz</p>
              <ChoiceGrid
                values={brand.tone}
                options={multiOptions.tone}
                onChange={(tone) => setBrand({ ...brand, tone })}
              />
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="space-y-5">
            <h1 className="text-2xl font-bold">Sua direção visual</h1>
            <label className="surface-subtle flex cursor-pointer items-center gap-4 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                <Upload />
              </span>
              <span>
                <b className="block text-sm">Enviar logo</b>
                <span className="text-muted text-xs">
                  PNG ou JPG para esta sessão
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    setBrand({ ...brand, logoUrl: URL.createObjectURL(file) });
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                Cor principal
                <input
                  className="mt-2 h-12 w-full rounded-xl border border-app-border bg-app-surface p-1"
                  type="color"
                  value={brand.primaryColor}
                  onChange={(e) =>
                    setBrand({ ...brand, primaryColor: e.target.value })
                  }
                />
              </label>
              <label className="text-sm font-semibold">
                Cor secundária
                <input
                  className="mt-2 h-12 w-full rounded-xl border border-app-border bg-app-surface p-1"
                  type="color"
                  value={brand.secondaryColor}
                  onChange={(e) =>
                    setBrand({ ...brand, secondaryColor: e.target.value })
                  }
                />
              </label>
            </div>
            <Select
              label="Estilo visual"
              value={brand.visualStyle}
              onChange={(e) =>
                setBrand({ ...brand, visualStyle: e.target.value })
              }
            >
              <option>Elegante</option>
              <option>Moderno</option>
              <option>Minimalista</option>
              <option>Ousado</option>
              <option>Orgânico</option>
            </Select>
          </div>
        )}
        {error && (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="mt-7 flex justify-between gap-3">
          <Button
            variant="secondary"
            type="button"
            disabled={step === 0}
            onClick={() => setStep((value) => value - 1)}
          >
            <ArrowLeft size={17} />
            Voltar
          </Button>
          {step < 5 ? (
            <Button type="button" onClick={next}>
              Continuar <ArrowRight size={17} />
            </Button>
          ) : (
            <Button
              type="button"
              loading={saving}
              onClick={() => void finish()}
            >
              Finalizar <Sparkles size={17} />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
