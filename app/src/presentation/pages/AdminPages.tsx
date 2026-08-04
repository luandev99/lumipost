import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bot,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Download,
  FileArchive,
  Image,
  Layers3,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Upload,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import type {
  ContentFormat,
  CreditProduct,
  Plan,
  PromptTask,
  PromptTemplate,
  TemplateMeta,
  User,
} from "../../domain/models";
import { formatLabels, statusLabels } from "../../domain/models";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  advanceQueue,
  cancelQueue,
  exportTemplate,
  exportTemplates,
  importTemplates,
  retryQueue,
  restoreSession,
  savePrompt,
  saveAdminCreditProduct,
  testAdminPrompt,
  updateAdminPlan,
  updateAdminUser,
} from "../store/store";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Notice,
  PageHeader,
  Select,
  Textarea,
} from "../ui";
import { errorMessage } from "../utils/errors";
import { downloadBlob } from "../utils/downloads";
import { AiCostPanel } from "../components/AiCostPanel";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const actorName = (name?: string) => name ?? "Admin";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const users = useAppSelector((state) => state.admin.users);
  const contents = useAppSelector((state) => state.contents.items);
  const queue = useAppSelector((state) => state.contents.queue);
  const templates = useAppSelector((state) => state.adminTemplates.catalog);
  const prompts = useAppSelector((state) => state.adminPrompts.items);
  const subscriptions = useAppSelector((state) => state.subscription.all);
  const audit = useAppSelector((state) => state.admin.audit);
  const stats = [
    {
      label: "Usuários",
      value: users.filter((item) => item.role === "user").length,
      icon: Users,
      tone: "from-blue-500 to-cyan-400",
    },
    {
      label: "Assinaturas",
      value: subscriptions.filter((item) => item.status === "active").length,
      icon: CreditCard,
      tone: "from-emerald-500 to-green-400",
    },
    {
      label: "Conteúdos",
      value: contents.length,
      icon: Image,
      tone: "from-violet-500 to-fuchsia-500",
    },
    {
      label: "Templates",
      value: templates.length,
      icon: Layers3,
      tone: "from-amber-500 to-orange-400",
    },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="Operação Lumipost"
        title="Visão geral"
        description="Dados consolidados do Supabase, dos ativos criativos e da fila."
        action={<Badge tone="success">Backend conectado</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-5">
            <div
              className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white`}
            >
              <Icon size={20} />
            </div>
            <span className="text-muted text-xs font-bold uppercase tracking-wider">
              {label}
            </span>
            <div className="mt-1 text-3xl font-black">{value}</div>
          </Card>
        ))}
      </div>
      <div className="mt-5">
        <AiCostPanel />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Saúde da produção</h2>
              <p className="text-muted text-sm">
                Status dos conteúdos e automações.
              </p>
            </div>
            <Activity className="text-app-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["scheduled", "published", "failed", "draft"] as const).map(
              (status) => (
                <div key={status} className="surface-subtle p-4">
                  <span className="text-muted text-[10px] font-bold uppercase">
                    {statusLabels[status]}
                  </span>
                  <b className="mt-1 block text-xl">
                    {contents.filter((item) => item.status === status).length}
                  </b>
                </div>
              ),
            )}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button
              className="surface-subtle flex items-center justify-between p-4 text-left"
              onClick={() => navigate("/admin/fila")}
            >
              <span>
                <b className="block text-sm">Fila</b>
                <span className="text-muted text-xs">
                  {queue.length} operações
                </span>
              </span>
              <ArrowUpRight size={17} />
            </button>
            <button
              className="surface-subtle flex items-center justify-between p-4 text-left"
              onClick={() => navigate("/admin/templates")}
            >
              <span>
                <b className="block text-sm">Biblioteca visual</b>
                <span className="text-muted text-xs">3 formatos</span>
              </span>
              <ArrowUpRight size={17} />
            </button>
            <button
              className="surface-subtle flex items-center justify-between p-4 text-left"
              onClick={() => navigate("/admin/prompts")}
            >
              <span>
                <b className="block text-sm">Prompts</b>
                <span className="text-muted text-xs">
                  {prompts.filter((item) => item.status === "active").length}{" "}
                  ativos
                </span>
              </span>
              <ArrowUpRight size={17} />
            </button>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">Atividade recente</h2>
          <div className="mt-4 space-y-4">
            {audit.slice(0, 5).map((event) => (
              <div key={event.id} className="flex gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-app-soft text-app-primary">
                  <Check size={14} />
                </span>
                <div>
                  <p className="text-sm">
                    <b>{event.actor}</b> {event.action.toLowerCase()}
                  </p>
                  <p className="text-muted text-xs">
                    {event.entity} ·{" "}
                    {format(new Date(event.at), "dd/MM 'às' HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const dispatch = useAppDispatch();
  const actor = useAppSelector((state) => state.auth.user);
  const users = useAppSelector((state) => state.admin.users);
  const subs = useAppSelector((state) => state.subscription.all);
  const plans = useAppSelector((state) => state.subscription.plans);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User>();
  const [creditDelta, setCreditDelta] = useState(0);
  const [reason, setReason] = useState("Ajuste solicitado pelo administrador");
  const filtered = users.filter((item) =>
    `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        eyebrow="Gestão de contas"
        title="Usuários"
        description="Perfis, provedores de login, acesso, assinatura e créditos persistidos."
      />
      <Card className="mb-5 p-4">
        <label className="relative block max-w-md">
          <Search
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted"
          />
          <input
            className="field pl-10"
            placeholder="Buscar por nome ou email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-app-elevated text-xs uppercase text-app-muted">
              <tr>
                <th className="px-5 py-4">Usuário</th>
                <th>Função</th>
                <th>Marca</th>
                <th>Plano</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const sub = subs.find(
                  (item) => item.userId === user.id && item.status === "active",
                );
                const plan = plans.find((item) => item.id === sub?.planId);
                return (
                  <tr key={user.id} className="border-t border-app-border">
                    <td className="px-5 py-4">
                      <b className="block">{user.name}</b>
                      <span className="text-muted text-xs">{user.email}</span>
                    </td>
                    <td>
                      <Badge
                        tone={user.role === "admin" ? "primary" : "neutral"}
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td>{user.brand?.brandName ?? "—"}</td>
                    <td>
                      {plan?.name ?? "Sem plano"}
                      {sub && (
                        <span className="text-muted block text-xs">
                          {sub.credits} créditos
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge
                        tone={user.status === "active" ? "success" : "danger"}
                      >
                        {user.status === "active" ? "Ativo" : "Suspenso"}
                      </Badge>
                    </td>
                    <td className="pr-5 text-right">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelected(user);
                          setCreditDelta(0);
                          setReason("Ajuste solicitado pelo administrador");
                        }}
                      >
                        Gerenciar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        title="Gerenciar usuário"
      >
        {selected && (
          <div className="space-y-4">
            <Input
              label="Nome"
              value={selected.name}
              onChange={(e) =>
                setSelected({ ...selected, name: e.target.value })
              }
            />
            <Select
              label="Função"
              value={selected.role}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  role: e.target.value as User["role"],
                })
              }
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </Select>
            <div className="surface-subtle p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted">Login</span>
                <b>{selected.authProviders?.join(", ") || "email"}</b>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-muted">Último acesso</span>
                <b>
                  {selected.lastSignInAt
                    ? format(new Date(selected.lastSignInAt), "dd/MM/yyyy HH:mm")
                    : "Ainda não registrado"}
                </b>
              </div>
            </div>
            <Input
              label="Ajuste de créditos (+ adiciona, − remove)"
              type="number"
              value={creditDelta}
              onChange={(event) => setCreditDelta(Number(event.target.value))}
            />
            <Textarea
              label="Motivo do ajuste"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Select
              label="Status"
              value={selected.status}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  status: e.target.value as User["status"],
                })
              }
            >
              <option value="active">Ativo</option>
              <option value="suspended">Suspenso</option>
            </Select>
            <Button
              className="w-full"
              onClick={async () => {
                await dispatch(
                  updateAdminUser({
                    id: selected.id,
                    patch: {
                      name: selected.name,
                      role: selected.role,
                      status: selected.status,
                    },
                    actor: actorName(actor?.name),
                    creditDelta,
                    reason,
                  }),
                ).unwrap();
                await dispatch(restoreSession()).unwrap();
                setSelected(undefined);
              }}
            >
              <Save size={17} />
              Salvar alterações
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function AdminQueuePage() {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => state.contents.queue);
  const contents = useAppSelector((state) => state.contents.items);
  const users = useAppSelector((state) => state.admin.users);
  const [status, setStatus] = useState("all");
  const filtered = queue.filter(
    (item) => status === "all" || item.status === status,
  );
  return (
    <div>
      <PageHeader
        eyebrow="Automação do Supabase"
        title="Fila de publicação"
        description="Inspecione a fila persistida, atualize o status, repita falhas ou cancele operações."
        action={
          <Button onClick={() => void dispatch(advanceQueue())}>
            <RefreshCw size={17} />
            Atualizar fila
          </Button>
        }
      />
      <Card className="mb-5 p-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          <option value="scheduled">Agendados</option>
          <option value="published">Publicados</option>
          <option value="failed">Falhas</option>
          <option value="canceled">Cancelados</option>
        </Select>
      </Card>
      <div className="space-y-3">
        {filtered.map((item) => {
          const content = contents.find((entry) => entry.id === item.contentId);
          const user = users.find((entry) => entry.id === item.userId);
          return (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                  <Clock3 size={19} />
                </span>
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{content?.title ?? item.contentId}</b>
                    <Badge
                      tone={
                        item.status === "failed"
                          ? "danger"
                          : item.status === "published"
                            ? "success"
                            : "primary"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-muted mt-1 text-xs">
                    {user?.email} ·{" "}
                    {format(
                      new Date(item.scheduledAt),
                      "dd/MM/yyyy 'às' HH:mm",
                    )}
                  </p>
                  {item.lastError && (
                    <p className="mt-1 text-xs text-red-500">
                      {item.lastError}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {item.status === "failed" && (
                    <Button
                      variant="secondary"
                      onClick={() => void dispatch(retryQueue(item.id))}
                    >
                      <RefreshCw size={16} />
                      Repetir
                    </Button>
                  )}
                  {["scheduled", "failed"].includes(item.status) && (
                    <Button
                      variant="secondary"
                      onClick={() => void dispatch(cancelQueue(item.id))}
                    >
                      <XCircle size={16} />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {!filtered.length && (
          <EmptyState
            icon={<Clock3 />}
            title="Fila vazia"
            description="Nenhum item corresponde ao filtro atual."
          />
        )}
      </div>
    </div>
  );
}

export function AdminPlansPage() {
  const dispatch = useAppDispatch();
  const actor = useAppSelector((state) => state.auth.user);
  const plans = useAppSelector((state) => state.subscription.plans);
  const creditProducts = useAppSelector((state) => state.subscription.creditProducts);
  const [selected, setSelected] = useState<Plan>();
  const [selectedCredit, setSelectedCredit] = useState<CreditProduct>();
  return (
    <div>
      <PageHeader
        eyebrow="Oferta comercial"
        title="Planos"
        description="Edite preço, duração, créditos e disponibilidade persistidos no Supabase."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`p-5 ${plan.featured ? "ring-2 ring-violet-500" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <Badge tone={plan.available ? "success" : "danger"}>
                  {plan.available ? "Disponível" : "Oculto"}
                </Badge>
                <h2 className="mt-3 text-lg font-bold">{plan.name}</h2>
              </div>
              <WalletCards className="text-app-primary" />
            </div>
            <div className="my-5 text-3xl font-black">{money(plan.price)}</div>
            <div className="space-y-2 text-sm text-app-muted">
              <p>{plan.credits} créditos</p>
              <p>{plan.durationDays} dias</p>
              <p>{plan.featured ? "Plano em destaque" : "Plano padrão"}</p>
            </div>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              onClick={() => setSelected(plan)}
            >
              Editar plano
            </Button>
          </Card>
        ))}
      </div>
      <div className="mt-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-app-primary">Stripe · compra avulsa</p>
          <h2 className="text-xl font-black">Pacotes de créditos</h2>
        </div>
        <Button variant="secondary" onClick={() => setSelectedCredit({ id: "", name: "", credits: 50, price: 19.9, available: true, featured: false, position: creditProducts.length })}>
          <Plus size={17} /> Novo pacote
        </Button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {creditProducts.map((product) => (
          <Card key={product.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone={product.available ? "success" : "danger"}>{product.available ? "Disponível" : "Oculto"}</Badge>
                <h3 className="mt-3 text-lg font-bold">{product.name}</h3>
              </div>
              <CreditCard className="text-app-primary" />
            </div>
            <p className="my-5 text-3xl font-black">{money(product.price)}</p>
            <p className="text-sm text-app-muted">{product.credits} créditos adicionais</p>
            <Button variant="secondary" className="mt-5 w-full" onClick={() => setSelectedCredit(product)}>Editar pacote</Button>
          </Card>
        ))}
      </div>
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        title="Editar plano"
      >
        {selected && (
          <div className="space-y-4">
            <Input
              label="Nome"
              value={selected.name}
              onChange={(e) =>
                setSelected({ ...selected, name: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Preço"
                type="number"
                step="0.01"
                value={selected.price}
                onChange={(e) =>
                  setSelected({ ...selected, price: Number(e.target.value) })
                }
              />
              <Input
                label="Créditos"
                type="number"
                value={selected.credits}
                onChange={(e) =>
                  setSelected({ ...selected, credits: Number(e.target.value) })
                }
              />
            </div>
            <Input
              label="Duração em dias"
              type="number"
              value={selected.durationDays}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  durationDays: Number(e.target.value),
                })
              }
            />
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={selected.available}
                onChange={(e) =>
                  setSelected({ ...selected, available: e.target.checked })
                }
              />
              Disponível para assinatura
            </label>
            <Button
              className="w-full"
              onClick={async () => {
                await dispatch(
                  updateAdminPlan({
                    id: selected.id,
                    patch: selected,
                    actor: actorName(actor?.name),
                  }),
                );
                setSelected(undefined);
              }}
            >
              <Save size={17} />
              Salvar plano
            </Button>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(selectedCredit)} onClose={() => setSelectedCredit(undefined)} title={selectedCredit?.id ? "Editar pacote de créditos" : "Novo pacote de créditos"}>
        {selectedCredit && <div className="space-y-4">
          <Notice tone="info">O preço é criado no Stripe pelo backend. Por segurança, o navegador não recebe nenhuma chave Stripe.</Notice>
          <Input label="Nome" value={selectedCredit.name} onChange={(e) => setSelectedCredit({ ...selectedCredit, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Créditos" type="number" min="1" value={selectedCredit.credits} onChange={(e) => setSelectedCredit({ ...selectedCredit, credits: Number(e.target.value) })} />
            <Input label="Preço" type="number" min="0.5" step="0.01" value={selectedCredit.price} onChange={(e) => setSelectedCredit({ ...selectedCredit, price: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={selectedCredit.available} onChange={(e) => setSelectedCredit({ ...selectedCredit, available: e.target.checked })} />Disponível para compra</label>
          <Button className="w-full" onClick={async () => { await dispatch(saveAdminCreditProduct({ product: selectedCredit, actor: actorName(actor?.name) })).unwrap(); setSelectedCredit(undefined); }}>
            <Save size={17} /> Salvar no Stripe
          </Button>
        </div>}
      </Modal>
    </div>
  );
}

export function AdminTemplatesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const actor = useAppSelector((state) => state.auth.user);
  const catalog = useAppSelector((state) => state.adminTemplates.catalog);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<
    "all" | TemplateMeta["format"]
  >("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [conflict, setConflict] = useState<"replace" | "rename" | "skip">(
    "rename",
  );
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const packages = useMemo(
    () => [...new Set(catalog.map((item) => item.packageId))].sort(),
    [catalog],
  );
  const filtered = catalog
    .filter(
      (item) =>
        (formatFilter === "all" || item.format === formatFilter) &&
        (packageFilter === "all" || item.packageId === packageFilter) &&
        `${item.name} ${item.packageId}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .slice(0, 72);
  const exportAll = async (format: TemplateMeta["format"]) => {
    setBusy(format);
    try {
      const result = await dispatch(exportTemplates(format)).unwrap();
      downloadBlob(result.blob, result.filename);
    } finally {
      setBusy("");
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow="Biblioteca visual · 728 arquivos"
        title="Templates"
        description="Catálogo carregado sob demanda, compatível com o schema v2.0 dos pacotes."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={17} />
              Importar
            </Button>
            <Button onClick={() => navigate("/admin/templates/novo")}>
              <Plus size={17} />
              Novo
            </Button>
          </div>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        {(["story", "post", "carousel"] as const).map((format) => (
          <button
            key={format}
            onClick={() => void exportAll(format)}
            className="surface-subtle flex min-h-20 flex-col items-center justify-center p-3 text-center"
          >
            <FileArchive className="mb-1 text-app-primary" size={19} />
            <b className="text-xs">
              {format === "story"
                ? "Stories"
                : format === "post"
                  ? "Posts"
                  : "Carrosséis"}
            </b>
            <span className="text-muted text-[10px]">
              {busy === format
                ? "Preparando..."
                : `${catalog.filter((item) => item.format === format).length} · exportar ZIP`}
            </span>
          </button>
        ))}
      </div>
      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_170px_200px]">
          <label className="relative">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted"
            />
            <input
              className="field pl-10"
              placeholder="Buscar template ou pacote"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Select
            value={formatFilter}
            onChange={(e) =>
              setFormatFilter(e.target.value as typeof formatFilter)
            }
          >
            <option value="all">Todos</option>
            <option value="post">Post</option>
            <option value="story">Story</option>
            <option value="carousel">Carrossel</option>
          </Select>
          <Select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
          >
            <option value="all">Todos os pacotes</option>
            {packages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </div>
      </Card>
      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((meta) => (
          <Card key={meta.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                <Layers3 size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="primary">{meta.format}</Badge>
                  <Badge>{meta.aspectRatio}</Badge>
                </div>
                <h3 className="truncate font-bold" title={meta.name}>
                  {meta.name}
                </h3>
                <p className="text-muted truncate text-xs">
                  {meta.packageId} · {meta.width}×{meta.height}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(`/admin/templates/${encodeURIComponent(meta.id)}`)
                }
              >
                Editar
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const result = await dispatch(
                    exportTemplate(meta.id),
                  ).unwrap();
                  downloadBlob(result.blob, result.filename);
                }}
              >
                <Download size={15} />
                JSON
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 72 && (
        <p className="text-muted mt-5 text-center text-xs">
          Mostrando os primeiros 72 resultados. Use os filtros para refinar.
        </p>
      )}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar pacote ZIP"
      >
        <div className="space-y-4">
          <label className="surface-subtle flex min-h-32 cursor-pointer flex-col items-center justify-center border-dashed p-5">
            <Upload className="mb-2 text-app-primary" />
            <b className="text-sm">
              {file?.name ?? "Selecione um arquivo ZIP"}
            </b>
            <span className="text-muted text-xs">
              JSONs v2.0 organizados por pacote
            </span>
            <input
              className="hidden"
              type="file"
              accept=".zip"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
          <Select
            label="Quando houver conflito"
            value={conflict}
            onChange={(e) => setConflict(e.target.value as typeof conflict)}
          >
            <option value="rename">Renomear importado</option>
            <option value="replace">Substituir atual</option>
            <option value="skip">Ignorar conflito</option>
          </Select>
          <Button
            className="w-full"
            disabled={!file}
            onClick={async () => {
              if (!file) return;
              const items = await dispatch(
                importTemplates({
                  file,
                  conflict,
                  actor: actorName(actor?.name),
                }),
              ).unwrap();
              setNotice(`${items.length} templates importados com sucesso.`);
              setImportOpen(false);
            }}
          >
            <Upload size={17} />
            Importar pacote
          </Button>
        </div>
      </Modal>
    </div>
  );
}

const promptTaskLabels: Record<PromptTask, string> = {
  "weekly-plan": "Plano semanal",
  "visual-copy": "Texto visual",
  caption: "Legenda",
  hashtags: "Hashtags",
  "reel-script": "Roteiro de Reel",
};
const newPrompt = (): PromptTemplate => ({
  id: crypto.randomUUID(),
  name: "Novo prompt",
  task: "caption",
  format: "all",
  version: 1,
  status: "draft",
  systemPrompt: "Você escreve para a marca {{brandName}}.",
  userPrompt: "Crie conteúdo sobre {{topic}}.",
  variables: ["brandName", "topic"],
  packages: [],
  outputSchema: '{"type":"object"}',
  updatedAt: new Date().toISOString(),
});
export function AdminPromptsPage() {
  const dispatch = useAppDispatch();
  const actor = useAppSelector((state) => state.auth.user);
  const prompts = useAppSelector((state) => state.adminPrompts.items);
  const [selected, setSelected] = useState<PromptTemplate>();
  const [sample, setSample] = useState({
    brandName: "Aurora Studio",
    topic: "consistência de marca",
    audience: "empreendedoras criativas",
  });
  const [playground, setPlayground] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<unknown>();
  const [playgroundModel, setPlaygroundModel] = useState("");
  const [playgroundBusy, setPlaygroundBusy] = useState(false);
  const [playgroundError, setPlaygroundError] = useState("");
  const interpolate = (text: string) =>
    text.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: keyof typeof sample) => sample[key] ?? `[${String(key)}]`,
    );
  return (
    <div>
      <PageHeader
        eyebrow="Motor de IA no Supabase"
        title="Prompts"
        description="Versione instruções, mantenha uma versão ativa por tarefa e teste com IA real."
        action={
          <Button onClick={() => setSelected(newPrompt())}>
            <Plus size={17} />
            Novo prompt
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {prompts.map((prompt) => (
          <Card key={prompt.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-soft text-app-primary">
                <Bot size={19} />
              </span>
              <div className="flex gap-2">
                <Badge
                  tone={
                    prompt.status === "active"
                      ? "success"
                      : prompt.status === "archived"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {prompt.status}
                </Badge>
                <Badge>v{prompt.version}</Badge>
              </div>
            </div>
            <h2 className="mt-4 font-bold">{prompt.name}</h2>
            <p className="text-muted mt-1 text-sm">
              {promptTaskLabels[prompt.task]} ·{" "}
              {prompt.format === "all"
                ? "Todos os formatos"
                : formatLabels[prompt.format]}
            </p>
            <p className="text-muted mt-3 line-clamp-2 text-xs leading-relaxed">
              {prompt.systemPrompt}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setSelected({ ...prompt })}
              >
                Editar
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected({ ...prompt });
                  setPlayground(true);
                  setPlaygroundResult(undefined);
                  setPlaygroundModel("");
                  setPlaygroundError("");
                }}
              >
                <Play size={15} />
                Testar
              </Button>
              <button
                className="icon-button"
                onClick={() =>
                  setSelected({
                    ...prompt,
                    id: crypto.randomUUID(),
                    name: `${prompt.name} — cópia`,
                    version: prompt.version + 1,
                    status: "draft",
                  })
                }
                aria-label="Duplicar"
              >
                <Copy size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          setSelected(undefined);
          setPlayground(false);
        }}
        title={playground ? "Playground do prompt" : "Editar prompt"}
        wide
      >
        {selected &&
          (playground ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <Input
                  label="Nome da marca"
                  value={sample.brandName}
                  onChange={(e) =>
                    setSample({ ...sample, brandName: e.target.value })
                  }
                />
                <Input
                  label="Tópico"
                  value={sample.topic}
                  onChange={(e) =>
                    setSample({ ...sample, topic: e.target.value })
                  }
                />
                <Input
                  label="Público"
                  value={sample.audience}
                  onChange={(e) =>
                    setSample({ ...sample, audience: e.target.value })
                  }
                />
                <Button
                  variant="secondary"
                  onClick={() => setPlayground(false)}
                >
                  Voltar ao editor
                </Button>
                <Button
                  loading={playgroundBusy}
                  onClick={async () => {
                    setPlaygroundBusy(true);
                    setPlaygroundError("");
                    try {
                      const response = await dispatch(
                        testAdminPrompt({ prompt: selected, sample }),
                      ).unwrap();
                      setPlaygroundResult(response.result);
                      setPlaygroundModel(response.model);
                    } catch (caught) {
                      setPlaygroundError(
                        errorMessage(caught, "Não foi possível testar o prompt."),
                      );
                    } finally {
                      setPlaygroundBusy(false);
                    }
                  }}
                >
                  <Sparkles size={16} />
                  Executar com IA
                </Button>
                {playgroundError && <Notice tone="error">{playgroundError}</Notice>}
              </div>
              <div className="space-y-4">
                <div className="surface-subtle p-4">
                  <span className="eyebrow">Prompt final</span>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {interpolate(selected.systemPrompt)}
                    {`\n\n`}
                    {interpolate(selected.userPrompt)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#111827] p-4 font-mono text-xs text-green-300">
                  <div className="mb-3 text-[10px] uppercase tracking-wider text-green-200/60">
                    {playgroundModel
                      ? `Resultado real · ${playgroundModel}`
                      : "Execute o prompt para obter o resultado"}
                  </div>
                  <pre className="whitespace-pre-wrap">{playgroundResult ? JSON.stringify(playgroundResult, null, 2) : "Aguardando execução…"}</pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Nome"
                  value={selected.name}
                  onChange={(e) =>
                    setSelected({ ...selected, name: e.target.value })
                  }
                />
                <Input
                  label="Versão"
                  type="number"
                  min={1}
                  value={selected.version}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      version: Number(e.target.value),
                    })
                  }
                />
                <Select
                  label="Tarefa"
                  value={selected.task}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      task: e.target.value as PromptTask,
                    })
                  }
                >
                  {Object.entries(promptTaskLabels).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Formato"
                  value={selected.format}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      format: e.target.value as ContentFormat | "all",
                    })
                  }
                >
                  <option value="all">Todos</option>
                  <option value="post">Post</option>
                  <option value="carousel">Carrossel</option>
                  <option value="story">Story</option>
                  <option value="reel">Reel</option>
                </Select>
              </div>
              <Textarea
                label="Prompt de sistema"
                value={selected.systemPrompt}
                onChange={(e) =>
                  setSelected({ ...selected, systemPrompt: e.target.value })
                }
              />
              <Textarea
                label="Prompt do usuário"
                value={selected.userPrompt}
                onChange={(e) =>
                  setSelected({ ...selected, userPrompt: e.target.value })
                }
              />
              <Input
                label="Variáveis separadas por vírgula"
                value={selected.variables.join(", ")}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    variables: e.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
              <Textarea
                label="Schema de saída"
                value={selected.outputSchema}
                onChange={(e) =>
                  setSelected({ ...selected, outputSchema: e.target.value })
                }
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPlayground(true);
                    setPlaygroundResult(undefined);
                    setPlaygroundModel("");
                    setPlaygroundError("");
                  }}
                >
                  <Play size={16} />
                  Testar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setSelected({ ...selected, status: "draft" })}
                >
                  <Archive size={16} />
                  Rascunho
                </Button>
                <Button
                  onClick={async () => {
                    await dispatch(
                      savePrompt({
                        prompt: { ...selected, status: "active" },
                        actor: actorName(actor?.name),
                      }),
                    );
                    setSelected(undefined);
                  }}
                >
                  <Sparkles size={16} />
                  Salvar e ativar
                </Button>
              </div>
            </div>
          ))}
      </Modal>
    </div>
  );
}
