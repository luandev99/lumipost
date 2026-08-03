import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate, useParams } from "react-router-dom";
import {
  Check,
  ChevronRight,
  CircleUserRound,
  Download,
  FileImage,
  Instagram,
  LogOut,
  Moon,
  Palette,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Sun,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { ContentFormat, ContentStatus } from "../../domain/models";
import { formatLabels, statusLabels } from "../../domain/models";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  cancelQueue,
  duplicateContent,
  logoutSession,
  retryQueue,
  uiActions,
} from "../store/store";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Select,
} from "../ui";
import { ContentPreview } from "../components/TemplateRenderer";
import { downloadContent } from "../utils/downloads";

const statusTone = (status: ContentStatus) =>
  status === "published"
    ? "success"
    : status === "failed" || status === "canceled"
      ? "danger"
      : status === "scheduled" || status === "processing"
        ? "primary"
        : "neutral";

export function LibraryPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAppSelector((state) => state.auth.user)!;
  const allContents = useAppSelector((state) => state.contents.items);
  const queue = useAppSelector((state) => state.contents.queue);
  const contents = allContents.filter((item) => item.userId === user.id);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<"all" | ContentFormat>(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>(
    "all",
  );
  const selected = contents.find((item) => item.id === id);
  const filtered = useMemo(
    () =>
      contents.filter(
        (item) =>
          (formatFilter === "all" || item.format === formatFilter) &&
          (statusFilter === "all" || item.status === statusFilter) &&
          `${item.title} ${item.topic}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [contents, search, formatFilter, statusFilter],
  );
  const selectedQueue = queue.find((item) => item.contentId === selected?.id);
  return (
    <div className="mobile-safe">
      <PageHeader
        eyebrow="Sua biblioteca"
        title="Conteúdos"
        description={`${contents.length} peças entre rascunhos, agenda e publicações.`}
        action={
          <Button onClick={() => navigate("/app/criar")}>
            <Sparkles size={17} />
            Criar
          </Button>
        }
      />
      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted"
              size={17}
            />
            <input
              className="field pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conteúdo..."
            />
          </label>
          <Select
            value={formatFilter}
            onChange={(e) =>
              setFormatFilter(e.target.value as typeof formatFilter)
            }
          >
            <option value="all">Todos os formatos</option>
            <option value="post">Posts</option>
            <option value="carousel">Carrosséis</option>
            <option value="story">Stories</option>
            <option value="reel">Reels</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
          >
            <option value="all">Todos os status</option>
            <option value="draft">Rascunhos</option>
            <option value="scheduled">Agendados</option>
            <option value="published">Publicados</option>
            <option value="failed">Falhas</option>
          </Select>
        </div>
      </Card>
      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((content) => (
            <button
              key={content.id}
              onClick={() => navigate(`/app/conteudos/${content.id}`)}
              className="surface-card overflow-hidden text-left transition hover:-translate-y-1 hover:border-violet-400"
            >
              <div className="flex h-52 items-center justify-center overflow-hidden bg-app-elevated">
                <ContentPreview
                  content={content}
                  width={
                    content.format === "story" || content.format === "reel"
                      ? 117
                      : 166
                  }
                />
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge tone="primary">{formatLabels[content.format]}</Badge>
                  <Badge tone={statusTone(content.status)}>
                    {statusLabels[content.status]}
                  </Badge>
                </div>
                <h2 className="line-clamp-2 font-bold leading-snug">
                  {content.title}
                </h2>
                <p className="text-muted mt-2 text-xs">
                  {content.scheduledAt
                    ? format(new Date(content.scheduledAt), "dd MMM · HH:mm", {
                        locale: ptBR,
                      })
                    : `Criado em ${format(new Date(content.createdAt), "dd/MM")}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FileImage />}
          title="Nenhum conteúdo encontrado"
          description="Ajuste os filtros ou crie sua primeira publicação."
          action={
            <Button onClick={() => navigate("/app/criar")}>
              Criar conteúdo
            </Button>
          }
        />
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => navigate("/app/conteudos")}
        title={selected?.title ?? "Conteúdo"}
        wide
      >
        {selected && (
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <div className="flex items-start justify-center rounded-2xl bg-app-elevated p-3">
              <ContentPreview
                content={selected}
                width={
                  selected.format === "story" || selected.format === "reel"
                    ? 220
                    : 260
                }
                className="rounded-xl"
              />
            </div>
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="primary">{formatLabels[selected.format]}</Badge>
                <Badge tone={statusTone(selected.status)}>
                  {statusLabels[selected.status]}
                </Badge>
                <Badge>
                  {selected.source === "ai"
                    ? "Criado com IA"
                    : selected.source === "upload"
                      ? "Upload pronto"
                      : "Biblioteca"}
                </Badge>
              </div>
              <p className="text-muted whitespace-pre-wrap text-sm leading-relaxed">
                {selected.caption}
              </p>
              <p className="mt-4 text-sm font-semibold text-app-primary">
                {selected.hashtags.join(" ")}
              </p>
              {selected.cta && (
                <div className="surface-subtle mt-4 p-3 text-sm">
                  <span className="text-muted block text-[10px] font-bold uppercase">
                    CTA
                  </span>
                  {selected.cta}
                </div>
              )}
              {selected.reelScript && (
                <div className="surface-subtle mt-4 p-4">
                  <b className="text-sm">
                    Roteiro de {selected.reelScript.duration}s
                  </b>
                  {selected.reelScript.scenes.map((scene, index) => (
                    <div key={scene.title} className="mt-3 text-sm">
                      <span className="font-bold text-app-primary">
                        {index + 1}. {scene.title}
                      </span>
                      <p className="text-muted">{scene.narration}</p>
                    </div>
                  ))}
                </div>
              )}
              {selected.failureReason && (
                <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500">
                  {selected.failureReason}
                </div>
              )}
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button onClick={() => void downloadContent(selected)}>
                  <Download size={17} />
                  Baixar
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await dispatch(
                      duplicateContent({ id: selected.id, userId: user.id }),
                    );
                    navigate("/app/conteudos");
                  }}
                >
                  <RotateCcw size={17} />
                  Duplicar
                </Button>
                {selectedQueue?.status === "failed" && (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await dispatch(retryQueue(selectedQueue.id));
                      navigate("/app/conteudos");
                    }}
                  >
                    <Check size={17} />
                    Tentar novamente
                  </Button>
                )}
                {selectedQueue &&
                  ["scheduled", "failed"].includes(selectedQueue.status) && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await dispatch(cancelQueue(selectedQueue.id));
                        navigate("/app/conteudos");
                      }}
                    >
                      <XCircle size={17} />
                      Cancelar
                    </Button>
                  )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 border-b border-app-border px-1 py-3 text-left last:border-0"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm">{title}</b>
        <span className="text-muted block truncate text-xs">{subtitle}</span>
      </span>
      <ChevronRight className="text-app-muted" size={17} />
    </button>
  );
}

export function MenuPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user)!;
  const brand = useAppSelector((state) => state.brand.profile);
  const subscription = useAppSelector((state) => state.subscription.current);
  const credits = useAppSelector((state) => state.credits.current);
  const availableCredits = credits?.available ?? subscription?.credits ?? 0;
  const plans = useAppSelector((state) => state.subscription.plans);
  const theme = useAppSelector((state) => state.ui.theme);
  const plan = plans.find((item) => item.id === subscription?.planId);
  return (
    <div className="mobile-safe mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Conta e preferências"
        title="Menu"
        description="Tudo o que a Lumipost usa para criar com a sua identidade."
      />
      <Card className="mb-4 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-400 to-purple-800 text-2xl font-bold text-white">
            {brand?.logoUrl ? (
              <img
                className="h-full w-full object-cover"
                src={brand.logoUrl}
                alt="Logo"
              />
            ) : (
              user.name[0]
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{user.name}</h2>
            <p className="text-muted truncate text-sm">{user.email}</p>
            <div className="mt-2">
              <Badge tone="success">Conta ativa</Badge>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <MenuRow
            icon={<CircleUserRound size={19} />}
            title="Informações pessoais"
            subtitle={user.email}
          />
          <MenuRow
            icon={<Palette size={19} />}
            title="Identidade da marca"
            subtitle={`${brand?.brandName ?? "Não configurada"} · ${brand?.visualStyle ?? ""}`}
          />
          <MenuRow
            icon={<Instagram size={19} />}
            title="Instagram"
            subtitle={
              brand?.instagramConnected
                ? `@${brand.instagram} conectado`
                : "Nenhuma conta conectada"
            }
          />
        </Card>
        <Card className="p-4">
          <MenuRow
            icon={<WalletCards size={19} />}
            title={plan?.name ?? "Assinatura"}
            subtitle={`${availableCredits} créditos disponíveis`}
            onClick={() => navigate("/app/assinatura")}
          />
          <MenuRow
            icon={theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            title="Aparência"
            subtitle={
              theme === "dark" ? "Modo escuro ativo" : "Modo claro ativo"
            }
            onClick={() => dispatch(uiActions.toggleTheme())}
          />
          <MenuRow
            icon={<Settings2 size={19} />}
            title="Preferências de conteúdo"
            subtitle={
              brand?.contentTypes
                .map((item) => formatLabels[item])
                .join(", ") ?? "Configurar"
            }
          />
        </Card>
      </div>
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Workspace protegido</p>
            <h3 className="font-bold">Dados sincronizados com o Supabase</h3>
            <p className="text-muted mt-1 text-sm">
              Conteúdos, agenda, assinatura e saldo permanecem vinculados à sua
              organização.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              void dispatch(logoutSession());
              navigate("/entrar");
            }}
          >
            <LogOut size={17} />
            Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}
