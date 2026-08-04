import JSZip from "jszip";
import { addDays, formatISO, startOfWeek } from "date-fns";
import type {
  AiGenerationRequest,
  BrandProfile,
  CreditProduct,
  Content,
  ContentFormat,
  ContentSource,
  CreditBalance,
  Plan,
  PromptTemplate,
  QueueItem,
  SocialAccount,
  Subscription,
  TemplateMeta,
  User,
  VisualTemplateV2,
  WeeklySlot,
} from "../domain/models";
import type {
  AiGenerationRepository,
  AuditRepository,
  AuthRepository,
  ContentRepository,
  CreditRepository,
  MediaRepository,
  PlannerRepository,
  PromptRepository,
  PublishingQueueRepository,
  SecureBackendGateway,
  SocialAccountRepository,
  SubscriptionRepository,
  TemplateRepository,
  UserRepository,
} from "../domain/repositories";
import {
  CREDIT_PACKAGES,
  MANUAL_SCHEDULE_CREDIT_COST,
  type CreditPackageId,
} from "../domain/creditRules";
import {
  BrowserTemplateRepository,
  MemoryAiGenerationRepository,
  MemoryAuditRepository,
  MemoryAuthRepository,
  MemoryContentRepository,
  MemoryMediaRepository,
  MemoryPlannerRepository,
  MemoryPromptRepository,
  MemoryQueueRepository,
  MemorySocialAccountRepository,
  MemorySubscriptionRepository,
  MemoryUserRepository,
} from "../infrastructure/repositories";
import { isSupabaseConfigured } from "../infrastructure/supabase/client";
import {
  SupabaseAuditRepository,
  SupabaseAuthRepository,
  SupabaseBackendGateway,
  SupabaseContentRepository,
  SupabaseCreditRepository,
  SupabaseMediaRepository,
  SupabasePlannerRepository,
  SupabasePromptRepository,
  SupabaseQueueRepository,
  SupabaseSocialAccountRepository,
  SupabaseSubscriptionRepository,
  SupabaseTemplateRepository,
  SupabaseUserRepository,
} from "../infrastructure/supabase/repositories";
import { validateTemplate } from "../infrastructure/templateSchema";

const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const hash = (text: string) =>
  [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);

export class ApplicationContainer {
  auth: AuthRepository;
  users: UserRepository;
  subscriptions: SubscriptionRepository;
  contents: ContentRepository;
  planner: PlannerRepository;
  templates: TemplateRepository;
  prompts: PromptRepository;
  queue: PublishingQueueRepository;
  audit: AuditRepository;
  ai?: AiGenerationRepository;
  socialAccounts: SocialAccountRepository;
  media: MediaRepository;
  credits?: CreditRepository;
  backend?: SecureBackendGateway;

  constructor() {
    if (isSupabaseConfigured) {
      this.templates = new SupabaseTemplateRepository();
      this.auth = new SupabaseAuthRepository();
      this.users = new SupabaseUserRepository();
      this.subscriptions = new SupabaseSubscriptionRepository();
      this.contents = new SupabaseContentRepository();
      this.media = new SupabaseMediaRepository();
      this.planner = new SupabasePlannerRepository();
      this.prompts = new SupabasePromptRepository();
      this.queue = new SupabaseQueueRepository();
      this.audit = new SupabaseAuditRepository();
      this.socialAccounts = new SupabaseSocialAccountRepository();
      this.credits = new SupabaseCreditRepository();
      this.backend = new SupabaseBackendGateway();
    } else if (import.meta.env.MODE === "test") {
      this.templates = new BrowserTemplateRepository();
      this.ai = new MemoryAiGenerationRepository();
      this.auth = new MemoryAuthRepository();
      this.users = new MemoryUserRepository();
      this.subscriptions = new MemorySubscriptionRepository();
      this.contents = new MemoryContentRepository();
      this.media = new MemoryMediaRepository();
      this.planner = new MemoryPlannerRepository();
      this.prompts = new MemoryPromptRepository();
      this.queue = new MemoryQueueRepository();
      this.audit = new MemoryAuditRepository();
      this.socialAccounts = new MemorySocialAccountRepository();
    } else {
      throw new Error(
        "Configuração pública do Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.",
      );
    }
  }

  async bootstrap() {
    if (this.backend) {
      return {
        users: [],
        plans: await this.subscriptions.listPlans(),
        subscriptions: [],
        contents: [],
        queue: [],
        templates: [],
        prompts: [],
        audit: [],
      };
    }
    return {
      users: await this.users.list(),
      plans: await this.subscriptions.listPlans(),
      subscriptions: await this.subscriptions.list(),
      contents: await this.contents.list(),
      queue: await this.queue.list(),
      templates: await this.templates.list(),
      prompts: await this.prompts.list(),
      audit: await this.audit.list(),
    };
  }
  async login(email: string, password: string) {
    const user = await this.auth.login(email, password);
    return this.loadSession(user);
  }
  private async loadSession(user: User) {
    const base = {
      user,
      subscription: await this.subscriptions.findForUser(user.id),
      creditBalance: await this.credits?.getBalance(),
      contents: await this.contents.list(user.id),
      queue: (await this.queue.list()).filter(
        (item) => item.userId === user.id,
      ),
      socialAccounts: await this.socialAccounts.list(user.id),
      templates: await this.templates.list(),
      prompts: await this.prompts.list(),
    };
    if (user.role !== "admin" || !this.backend) return base;
    const admin = await this.backend.getAdminSnapshot();
    return { ...base, ...admin, user };
  }
  async loginWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await this.auth.loginWithGoogle(redirectTo);
  }
  async restoreSession() {
    const user = await this.auth.current();
    if (!user) return undefined;
    return this.loadSession(user);
  }
  async logout() {
    await this.auth.logout();
  }
  async getCreditBalance() {
    return this.credits?.getBalance();
  }
  async listCreditTransactions(days: number) {
    return (await this.credits?.listTransactions(days)) ?? [];
  }
  async uploadMedia(files: File[]) {
    return this.media.upload(files);
  }
  subscribeCreditBalance(
    organizationId: string,
    onBalance: (balance: CreditBalance) => void,
  ) {
    return (
      this.credits?.subscribe(organizationId, onBalance) ?? (() => undefined)
    );
  }
  async register(input: { name: string; email: string; password: string }) {
    return this.auth.register(input);
  }
  async finishOnboarding(userId: string, brand: BrandProfile) {
    return this.users.completeOnboarding(userId, brand);
  }
  async subscribe(userId: string, planId: Plan["id"]) {
    return this.subscriptions.subscribe(userId, planId);
  }
  async purchaseCredits(userId: string, packageId: CreditPackageId) {
    const creditPackage = CREDIT_PACKAGES.find((item) => item.id === packageId);
    if (!creditPackage) throw new Error("Pacote de créditos não encontrado.");
    return this.subscriptions.addCredits(userId, creditPackage.credits);
  }
  async startBillingCheckout(
    input:
      | { userId: string; kind: "plan"; planId: "month" | "year" }
      | { userId: string; kind: "credits"; packageId: CreditPackageId },
  ) {
    if (!this.backend)
      throw new Error("Checkout indisponível fora do backend Supabase.");
    const catalogId = input.kind === "plan" ? input.planId : input.packageId;
    const idempotencyKey = `billing:${input.userId}:${input.kind}:${catalogId}:${Date.now()}`;
    const request =
      input.kind === "plan"
        ? {
            kind: "subscription" as const,
            planId: input.planId,
            idempotencyKey,
          }
        : {
            kind: "credit_pack" as const,
            creditProductId: input.packageId.replace("boost-", "credits_"),
            idempotencyKey,
          };
    return {
      mode: "redirect" as const,
      ...(await this.backend.createCheckout(request)),
    };
  }
  async openBillingPortal() {
    if (!this.backend)
      throw new Error(
        "O portal de cobrança está disponível apenas com Stripe configurado.",
      );
    return this.backend.createBillingPortal();
  }
  async connectInstagram(returnPath = "/social-accounts") {
    if (this.backend) return this.backend.startMetaOAuth(returnPath);
    return { authorizationUrl: "" };
  }
  async disconnectInstagram(socialAccountId: string) {
    if (this.backend) await this.backend.disconnectMeta(socialAccountId);
    else
      await this.socialAccounts.update(socialAccountId, {
        connected: false,
        expiresAt: undefined,
      });
  }
  async analyzeInstagramBrand(input: {
    brandId: string;
    socialAccountId: string;
  }) {
    if (!this.backend)
      throw new Error(
        "A análise real exige Supabase, Meta e OpenAI configurados.",
      );
    return this.backend.analyzeInstagramBrand({
      ...input,
      applyAutomatically: true,
    });
  }
  async previewAiContent(input: AiGenerationRequest) {
    if (this.backend) return this.backend.previewAiContent(input);
    const user = await this.users.find(input.userId);
    if (!user || !this.ai) throw new Error("Usuário não encontrado.");
    return this.ai.preview(input, user.brand);
  }

  async createContent(input: {
    userId: string;
    title: string;
    format: ContentFormat;
    source: Exclude<ContentSource, "ai">;
    topic?: string;
    caption?: string;
    hashtags?: string[];
    cta?: string;
    mediaUrls?: string[];
    slideTexts?: string[];
    altText?: string;
    location?: string;
    link?: string;
    firstComment?: string;
    collaborators?: string[];
    taggedPeople?: string[];
    socialAccountIds?: string[];
  }) {
    const now = new Date().toISOString();
    const content: Content = {
      id: id("content"),
      userId: input.userId,
      title: input.title || "Conteúdo sem título",
      format: input.format,
      source: input.source,
      status: "draft",
      topic: input.topic || input.title,
      caption: input.caption ?? "",
      hashtags: input.hashtags ?? [],
      cta: input.cta ?? "",
      createdAt: now,
      updatedAt: now,
      mediaUrls: input.mediaUrls ?? [],
      slideTexts: input.slideTexts,
      altText: input.altText,
      location: input.location,
      link: input.link,
      firstComment: input.firstComment,
      collaborators: input.collaborators,
      taggedPeople: input.taggedPeople,
      socialAccountIds: input.socialAccountIds ?? [],
      tags: [],
      usageCount: 0,
    };
    return this.contents.save(content);
  }

  async updateContentItem(
    idValue: string,
    userId: string,
    patch: Partial<Content>,
  ) {
    const current = await this.contents.find(idValue);
    if (!current || current.userId !== userId)
      throw new Error("Conteúdo não encontrado.");
    return this.contents.update(idValue, patch);
  }
  async deleteContentItem(idValue: string, userId: string) {
    const current = await this.contents.find(idValue);
    if (!current || current.userId !== userId)
      throw new Error("Conteúdo não encontrado.");
    const queued = (await this.queue.list()).filter(
      (item) =>
        item.contentId === idValue &&
        !["published", "canceled"].includes(item.status),
    );
    for (const item of queued) {
      if (this.backend)
        await this.backend.queueAction({ action: "cancel", jobId: item.id });
      else await this.queue.update(item.id, { status: "canceled" });
    }
    await this.contents.remove(idValue);
    return {
      contents: await this.contents.list(userId),
      queue: (await this.queue.list()).filter((item) => item.userId === userId),
    };
  }
  async rescheduleQueueItem(
    idValue: string,
    userId: string,
    scheduledAt: string,
  ) {
    if (new Date(scheduledAt) <= new Date())
      throw new Error("Escolha um horário futuro.");
    const item = (await this.queue.list()).find(
      (entry) => entry.id === idValue && entry.userId === userId,
    );
    if (!item) throw new Error("Agendamento não encontrado.");
    if (this.backend) {
      await this.backend.queueAction({
        action: "reschedule",
        jobId: idValue,
        scheduledAt,
        timezone: item.timezone ?? "America/Sao_Paulo",
      });
    } else {
      await this.queue.update(idValue, { scheduledAt, status: "scheduled" });
      await this.contents.update(item.contentId, {
        scheduledAt,
        status: "scheduled",
      });
    }
    return {
      contents: await this.contents.list(userId),
      queue: (await this.queue.list()).filter(
        (entry) => entry.userId === userId,
      ),
    };
  }
  async publishQueueItem(idValue: string, userId: string) {
    const item = (await this.queue.list()).find(
      (entry) => entry.id === idValue && entry.userId === userId,
    );
    if (!item) throw new Error("Agendamento não encontrado.");
    if (this.backend) {
      await this.backend.queueAction({
        action: "reschedule",
        jobId: idValue,
        scheduledAt: new Date(Date.now() + 15_000).toISOString(),
        timezone: item.timezone ?? "America/Sao_Paulo",
      });
      return {
        contents: await this.contents.list(userId),
        queue: (await this.queue.list()).filter(
          (entry) => entry.userId === userId,
        ),
      };
    }
    const publishedAt = new Date().toISOString();
    await this.queue.update(idValue, {
      status: "published",
      attempts: item.attempts + 1,
    });
    await this.contents.update(item.contentId, {
      status: "published",
      publishedAt,
    });
    return {
      contents: await this.contents.list(userId),
      queue: (await this.queue.list()).filter(
        (entry) => entry.userId === userId,
      ),
    };
  }
  async updateSocialAccount(idValue: string, patch: Partial<SocialAccount>) {
    return this.socialAccounts.update(idValue, patch);
  }

  private copyFor(format: ContentFormat, topic: string, brand?: BrandProfile) {
    const brandName = brand?.brandName || "Sua marca";
    const options = [
      {
        title: `${topic}: o que ninguém te conta`,
        caption: `Existe um jeito mais simples de olhar para ${topic.toLowerCase()}. ${brandName} reuniu os pontos que realmente fazem diferença.`,
        cta: "Salve para consultar depois",
      },
      {
        title: `Um novo olhar para ${topic}`,
        caption: `Boas escolhas começam com clareza. Hoje vamos transformar ${topic.toLowerCase()} em uma ação possível e consistente.`,
        cta: "Compartilhe com alguém",
      },
      {
        title: `3 passos para evoluir em ${topic}`,
        caption: `Você não precisa fazer tudo de uma vez. Comece pelo essencial e construa resultado com intenção.`,
        cta: "Qual passo você começa hoje?",
      },
    ];
    return options[hash(`${format}:${topic}`) % options.length];
  }

  async generateContent(input: {
    userId: string;
    title?: string;
    format: ContentFormat;
    source?: ContentSource;
    topic: string;
    slides?: number;
    caption?: string;
    cta?: string;
    hashtags?: string[];
    mediaUrls?: string[];
    slideTexts?: string[];
    reelScript?: Content["reelScript"];
  }) {
    const source = input.source ?? "ai";
    if (this.backend && source === "ai") {
      const generated = await this.backend.generateAiContent({
        idempotencyKey: `content:${input.userId}:${crypto.randomUUID()}`,
        title: input.title,
        topic: input.topic,
        format: input.format,
        slides: input.format === "carousel" ? input.slides : undefined,
        caption: input.caption,
        hashtags: input.hashtags,
        cta: input.cta,
        slideTexts: input.slideTexts,
        reelScript: input.reelScript,
      });
      const content = await this.contents.find(generated.contentId);
      if (!content) throw new Error("Conteúdo não encontrado após a geração.");
      const subscription = await this.subscriptions.findForUser(input.userId);
      if (subscription) subscription.credits = generated.credits.available;
      return {
        content,
        subscription,
        creditBalance: generated.credits,
        chargedCredits: generated.chargedCredits,
      };
    }
    if (this.backend && source !== "ai") {
      const content = await this.createContent({
        userId: input.userId,
        title: input.title || input.topic,
        format: input.format,
        source: source as Exclude<ContentSource, "ai">,
        topic: input.topic,
        caption: input.caption,
        hashtags: input.hashtags,
        cta: input.cta,
        mediaUrls: input.mediaUrls,
        slideTexts: input.slideTexts,
      });
      return {
        content,
        subscription: await this.subscriptions.findForUser(input.userId),
        creditBalance: await this.credits?.getBalance(),
        chargedCredits: 0,
      };
    }
    const user = await this.users.find(input.userId);
    if (!user) throw new Error("Usuário não encontrado.");
    const slides =
      input.format === "carousel"
        ? Math.min(10, Math.max(2, input.slides ?? 5))
        : 1;
    const cost =
      (input.source ?? "ai") === "ai"
        ? input.format === "carousel"
          ? 5 * slides
          : input.format === "video"
            ? 15
            : input.format === "caption"
              ? 2
              : 5
        : 0;
    if (cost) await this.subscriptions.spend(input.userId, cost);
    const copy = this.copyFor(input.format, input.topic, user.brand);
    const templateFormat =
      input.format === "reel" || input.format === "video"
        ? "story"
        : input.format === "caption"
          ? "post"
          : input.format;
    const catalog = await this.templates.list();
    const candidates = catalog.filter((item) => item.format === templateFormat);
    const template =
      candidates[hash(input.topic) % Math.max(1, candidates.length)];
    const now = new Date().toISOString();
    const content: Content = {
      id: id("content"),
      userId: input.userId,
      title: input.title || copy.title,
      format: input.format,
      source: input.source ?? "ai",
      status: "draft",
      topic: input.topic,
      caption: input.caption || copy.caption,
      hashtags: input.hashtags?.length
        ? input.hashtags
        : ["#conteudo", "#marketingdigital", "#marcas"],
      cta: input.cta || copy.cta,
      createdAt: now,
      updatedAt: now,
      templatePath: template?.path,
      mediaUrls: input.mediaUrls ?? [],
      slideTexts:
        input.format === "carousel"
          ? Array.from({ length: slides }, (_, index) =>
              index === 0
                ? input.title || copy.title
                : index === slides - 1
                  ? copy.cta
                  : `${index}. ${["Comece pelo essencial", "Crie uma rotina possível", "Meça o que importa", "Ajuste com intenção"][index % 4]}`,
            )
          : undefined,
      reelScript:
        input.format === "reel" || input.format === "video"
          ? {
              hook: input.title || copy.title,
              duration: 24,
              scenes: [
                { title: "Gancho", narration: input.title || copy.title },
                {
                  title: "Desenvolvimento",
                  narration: input.caption || copy.caption,
                },
                { title: "Fechamento", narration: input.cta || copy.cta },
              ],
            }
          : undefined,
      socialAccountIds: ["social-instagram"],
      tags: ["IA"],
      usageCount: 0,
    };
    await this.contents.save(content);
    return {
      content,
      subscription: await this.subscriptions.findForUser(input.userId),
    };
  }

  async scheduleContent(
    userId: string,
    contentId: string,
    scheduledAt: string,
    options?: {
      timezone?: string;
      socialAccountId?: string;
      approvalRequired?: boolean;
      notifyBefore?: boolean;
      firstComment?: string;
    },
  ) {
    if (new Date(scheduledAt) <= new Date())
      throw new Error("Escolha um horário futuro.");
    const content = await this.contents.find(contentId);
    if (!content || content.userId !== userId)
      throw new Error("Conteúdo não encontrado.");
    if (this.backend) {
      const idempotencyKey = `schedule:${contentId}:${scheduledAt.replace(/[^0-9]/g, "")}`;
      const result = await this.backend.scheduleContent({
        contentId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        timezone: options?.timezone ?? "America/Sao_Paulo",
        socialAccountId: options?.socialAccountId,
        idempotencyKey,
      });
      const subscription = await this.subscriptions.findForUser(userId);
      if (subscription) subscription.credits = result.credits.available;
      return {
        contents: await this.contents.list(userId),
        queue: (await this.queue.list()).filter(
          (item) => item.userId === userId,
        ),
        subscription,
        creditBalance: result.credits,
        chargedCredits: result.chargedCredits,
      };
    }
    const subscription = await this.subscriptions.spend(
      userId,
      MANUAL_SCHEDULE_CREDIT_COST,
    );
    await this.contents.update(contentId, {
      status: options?.approvalRequired ? "awaiting_approval" : "scheduled",
      scheduledAt,
      firstComment: options?.firstComment ?? content.firstComment,
      socialAccountIds: options?.socialAccountId
        ? [options.socialAccountId]
        : content.socialAccountIds,
    });
    const item: QueueItem = {
      id: id("queue"),
      userId,
      contentId,
      scheduledAt,
      status: options?.approvalRequired ? "paused" : "scheduled",
      attempts: 0,
      timezone: options?.timezone ?? "America/Sao_Paulo",
      socialAccountId: options?.socialAccountId ?? "social-instagram",
      approvalRequired: options?.approvalRequired,
      notifyBefore: options?.notifyBefore,
    };
    await this.queue.enqueue([item]);
    return {
      contents: await this.contents.list(userId),
      queue: (await this.queue.list()).filter(
        (queueItem) => queueItem.userId === userId,
      ),
      subscription,
      chargedCredits: MANUAL_SCHEDULE_CREDIT_COST,
    };
  }

  suggestWeek(weekStart?: string): WeeklySlot[] {
    const monday = weekStart
      ? startOfWeek(new Date(`${weekStart}T12:00:00`), { weekStartsOn: 1 })
      : startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
    const formats: ContentFormat[] = [
      "post",
      "carousel",
      "story",
      "reel",
      "post",
    ];
    const topics = [
      "Dica prática da semana",
      "Erros que afastam clientes",
      "Bastidores da marca",
      "Transformação em 3 cenas",
      "Convite para a comunidade",
    ];
    return formats.map((format, index) => ({
      id: id("slot"),
      format,
      source: "ai",
      topic: topics[index],
      date: formatISO(addDays(monday, index), { representation: "date" }),
      time: ["10:00", "12:30", "18:00", "19:30", "11:00"][index],
      quantity: 1,
      slides: format === "carousel" ? 5 : 1,
      cost: format === "carousel" ? 25 : 5,
    }));
  }

  async suggestWeekWithAi(input: {
    weekStart: string;
    selectedDays: number[];
    formats: Array<"post" | "carousel" | "story" | "reel">;
    quantity: number;
    preferredTime: string;
    objective: string;
    preferences: {
      avoidRepeated: boolean;
      varyTopics: boolean;
      includeDates: boolean;
      useProducts: boolean;
      usePrevious: boolean;
    };
  }) {
    if (this.backend) return this.backend.generateWeeklyPlan(input);
    return this.suggestWeek(input.weekStart)
      .filter((_, index) => input.selectedDays.includes(index))
      .map((slot) => ({ ...slot, quantity: input.quantity }));
  }

  async confirmWeek(userId: string, weekStart: string, slots: WeeklySlot[]) {
    const distinctDays = new Set(slots.map((slot) => slot.date)).size;
    if (distinctDays < 1 || distinctDays > 7)
      throw new Error("Selecione entre 1 e 7 dias da semana.");

    const conflicts = new Set<string>();
    const contentsPerDay = new Map<string, number>();
    const scheduleTime = (initial: string, index: number) => {
      const [hour, minute] = initial.split(":").map(Number);
      const totalMinutes = hour * 60 + minute + index * 120;
      if (!Number.isFinite(totalMinutes) || totalMinutes >= 24 * 60)
        throw new Error(
          "Escolha um primeiro horário mais cedo para distribuir os conteúdos a cada 2 horas.",
        );
      return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
    };

    for (const slot of slots) {
      const quantity = slot.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5)
        throw new Error("Cada dia deve ter entre 1 e 5 conteúdos.");
      const dayTotal = (contentsPerDay.get(slot.date) ?? 0) + quantity;
      if (dayTotal > 5)
        throw new Error("Cada dia pode ter no máximo 5 conteúdos.");
      contentsPerDay.set(slot.date, dayTotal);
      if (!slot.topic.trim())
        throw new Error("Preencha o assunto de todos os conteúdos.");

      for (let index = 0; index < quantity; index += 1) {
        const key = `${slot.date}T${scheduleTime(slot.time, index)}`;
        if (conflicts.has(key))
          throw new Error("Existem conteúdos no mesmo dia e horário.");
        conflicts.add(key);
        if (new Date(`${key}:00`) <= new Date())
          throw new Error("Todos os horários precisam estar no futuro.");
      }
    }

    const totalCost = slots.reduce((sum, slot) => {
      const quantity = slot.quantity ?? 1;
      if (slot.source !== "ai")
        return sum + MANUAL_SCHEDULE_CREDIT_COST * quantity;
      return (
        sum +
        5 * (slot.format === "carousel" ? slot.slides : 1) * quantity
      );
    }, 0);
    if (this.backend) {
      const balance = await this.credits?.getBalance();
      if (!balance || balance.available < totalCost)
        throw new Error("Créditos insuficientes para gerar esta semana.");
      const account = (await this.socialAccounts.list(userId)).find(
        (item) => item.network === "instagram" && item.connected,
      );
      if (!account)
        throw new Error(
          "Conecte uma conta profissional do Instagram antes de confirmar a semana.",
        );
      // Reel/vídeo por IA nasce sempre como rascunho (o worker força isso em
      // process-weekly-slots, ignorando o horário do slot): o Higgsfield
      // gera de forma assíncrona e o vídeo real precisa ser revisado antes
      // de ir ao ar, então não há guard de bloqueio aqui.

      // A geração de fato acontece em background (worker acionado por cron,
      // veja process-weekly-slots): aqui só persistimos o plano e os slots
      // pendentes, para que o progresso sobreviva a F5/fechar a aba.
      const items: Array<{
        date: string;
        time: string;
        format: WeeklySlot["format"];
        source: WeeklySlot["source"];
        topic: string;
        slides: number;
        cost: number;
        libraryContentId?: string;
      }> = [];
      for (const slot of slots) {
        const quantity = slot.quantity ?? 1;
        for (let generationIndex = 0; generationIndex < quantity; generationIndex += 1) {
          const time = scheduleTime(slot.time, generationIndex);
          const topic = quantity > 1
            ? `${slot.topic} — ideia ${generationIndex + 1}`
            : slot.topic;
          if (slot.source !== "ai" && !slot.libraryContentId)
            throw new Error(
              "Para conteúdo pronto, selecione primeiro um item salvo na biblioteca.",
            );
          items.push({
            date: slot.date,
            time,
            format: slot.format,
            source: slot.source,
            topic,
            slides: slot.slides,
            cost: slot.source === "ai"
              ? 5 * (slot.format === "carousel" ? slot.slides : 1)
              : MANUAL_SCHEDULE_CREDIT_COST,
            libraryContentId: slot.libraryContentId,
          });
        }
      }

      const { planId, slotIds } = await this.planner.createPendingWeeklyPlan({
        userId,
        weekStart,
        items,
      });

      // Itens de biblioteca não precisam de IA: resolvidos na hora.
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item.source === "ai") continue;
        const scheduledAt = new Date(`${item.date}T${item.time}:00`).toISOString();
        const copy = await this.duplicateContent(item.libraryContentId!, userId);
        await this.scheduleContent(userId, copy.id, scheduledAt, {
          timezone: "America/Sao_Paulo",
          socialAccountId: account.id,
        });
        await this.planner.resolveWeeklySlot(slotIds[index], copy.id);
      }

      // A lista completa de conteúdos/fila não é reconstruída aqui: a
      // geração é assíncrona agora, então essas listas ficam vazias — quem
      // precisa acompanhar o progresso usa getWeeklyPlanProgress(planId).
      return {
        planId,
        contents: [] as Content[],
        generatedContents: [] as Content[],
        queue: [] as QueueItem[],
        subscription: undefined as Subscription | undefined,
      };
    }
    if (totalCost) await this.subscriptions.spend(userId, totalCost);

    const user = await this.users.find(userId);
    const catalog = await this.templates.list();
    const contents: Content[] = [];
    const queue: QueueItem[] = [];

    for (const slot of slots) {
      const quantity = slot.quantity ?? 1;
      for (
        let generationIndex = 0;
        generationIndex < quantity;
        generationIndex += 1
      ) {
        const topic =
          quantity > 1
            ? `${slot.topic} — ideia ${generationIndex + 1}`
            : slot.topic;
        const copy = this.copyFor(slot.format, topic, user?.brand);
        const templateFormat = slot.format === "reel" ? "story" : slot.format;
        const candidates = catalog.filter(
          (item) => item.format === templateFormat,
        );
        const template =
          candidates[hash(topic) % Math.max(candidates.length, 1)];
        const time = scheduleTime(slot.time, generationIndex);
        const scheduledAt = new Date(`${slot.date}T${time}:00`).toISOString();
        const content: Content = {
          id: id("content"),
          userId,
          title: copy.title,
          format: slot.format,
          source: slot.source,
          status: "scheduled",
          topic,
          caption: copy.caption,
          hashtags: ["#conteudo", "#estrategia"],
          cta: copy.cta,
          scheduledAt,
          createdAt: new Date().toISOString(),
          mediaUrls: [],
          templatePath: template?.path,
          slideTexts:
            slot.format === "carousel"
              ? Array.from({ length: slot.slides }, (_, index) =>
                  index === 0
                    ? copy.title
                    : `${index}. Uma ideia que move sua marca`,
                )
              : undefined,
          reelScript:
            slot.format === "reel"
              ? {
                  hook: copy.title,
                  duration: 24,
                  scenes: [
                    { title: "Gancho", narration: copy.title },
                    { title: "Valor", narration: copy.caption },
                    { title: "CTA", narration: copy.cta },
                  ],
                }
              : undefined,
        };
        await this.contents.save(content);
        contents.push(content);
        queue.push({
          id: id("queue"),
          userId,
          contentId: content.id,
          scheduledAt,
          status: "scheduled",
          attempts: 0,
        });
      }
    }

    await this.queue.enqueue(queue);
    const offlinePlanId = id("week");
    await this.planner.save({
      id: offlinePlanId,
      userId,
      weekStart,
      status: "confirmed",
      slots,
    });
    return {
      planId: offlinePlanId,
      contents: await this.contents.list(userId),
      generatedContents: contents,
      queue: (await this.queue.list()).filter((item) => item.userId === userId),
      subscription: await this.subscriptions.findForUser(userId),
    };
  }

  getWeeklyPlanProgress(planId: string) {
    return this.planner.getWeeklyPlanProgress(planId);
  }
  listWeeklyPlanSummaries(userId: string) {
    return this.planner.listWeeklyPlanSummaries(userId);
  }
  // Criação avulsa de um conteúdo (fora do planejamento semanal) reaproveita
  // o mesmo pipeline persistido/background: um "plano" de um item só.
  async createSingleContentPlan(
    userId: string,
    input: {
      date: string;
      time: string;
      scheduled: boolean;
      format: ContentFormat;
      topic: string;
      slides: number;
      cost: number;
      socialAccountId?: string;
      title?: string;
      caption?: string;
      hashtags?: string[];
      cta?: string;
      slideTexts?: string[];
      reelScript?: Content["reelScript"];
      referenceImagePath?: string;
      referenceMode?: "base" | "context";
    },
  ) {
    return this.planner.createPendingWeeklyPlan({
      userId,
      weekStart: input.date,
      items: [
        {
          date: input.date,
          time: input.time,
          scheduled: input.scheduled,
          format: input.format,
          source: "ai",
          topic: input.topic,
          slides: input.slides,
          cost: input.cost,
          draft: {
            title: input.title,
            caption: input.caption,
            hashtags: input.hashtags,
            cta: input.cta,
            slideTexts: input.slideTexts,
            reelScript: input.reelScript,
            socialAccountId: input.socialAccountId,
            referenceImagePath: input.referenceImagePath,
            referenceMode: input.referenceMode,
          },
        },
      ],
    });
  }
  retryWeeklySlot(slotId: string) {
    return this.planner.retryWeeklySlot(slotId);
  }
  subscribeToWeeklyPlanProgress(planId: string, onChange: () => void) {
    return this.planner.subscribeToWeeklyPlanProgress(planId, onChange);
  }

  async advanceQueue(userId?: string) {
    if (this.backend) {
      return {
        contents: userId
          ? await this.contents.list(userId)
          : await this.contents.list(),
        queue: userId
          ? (await this.queue.list()).filter((item) => item.userId === userId)
          : await this.queue.list(),
      };
    }
    const items = (await this.queue.list())
      .filter(
        (item) =>
          item.status === "scheduled" && (!userId || item.userId === userId),
      )
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const next = items[0];
    if (!next)
      return {
        contents: userId
          ? await this.contents.list(userId)
          : await this.contents.list(),
        queue: await this.queue.list(),
      };
    await this.queue.update(next.id, {
      status: "published",
      attempts: next.attempts + 1,
    });
    await this.contents.update(next.contentId, {
      status: "published",
      scheduledAt: next.scheduledAt,
    });
    return {
      contents: userId
        ? await this.contents.list(userId)
        : await this.contents.list(),
      queue: userId
        ? (await this.queue.list()).filter((item) => item.userId === userId)
        : await this.queue.list(),
    };
  }
  async retryQueue(idValue: string) {
    const item = (await this.queue.list()).find(
      (entry) => entry.id === idValue,
    );
    if (!item) throw new Error("Item não encontrado.");
    if (this.backend) {
      await this.backend.queueAction({ action: "retry", jobId: item.id });
      return {
        contents: await this.contents.list(),
        queue: await this.queue.list(),
      };
    }
    await this.queue.update(item.id, {
      status: "published",
      attempts: item.attempts + 1,
      lastError: undefined,
    });
    await this.contents.update(item.contentId, {
      status: "published",
      failureReason: undefined,
    });
    return {
      contents: await this.contents.list(),
      queue: await this.queue.list(),
    };
  }
  async cancelQueue(idValue: string) {
    const item = (await this.queue.list()).find(
      (entry) => entry.id === idValue,
    );
    if (!item) throw new Error("Item não encontrado.");
    if (this.backend) {
      await this.backend.queueAction({ action: "cancel", jobId: item.id });
      return {
        contents: await this.contents.list(),
        queue: await this.queue.list(),
      };
    }
    await this.queue.update(item.id, { status: "canceled" });
    await this.contents.update(item.contentId, { status: "canceled" });
    return {
      contents: await this.contents.list(),
      queue: await this.queue.list(),
    };
  }
  async duplicateContent(idValue: string, userId: string) {
    const original = await this.contents.find(idValue);
    if (!original) throw new Error("Conteúdo não encontrado.");
    const now = new Date().toISOString();
    const copy = {
      ...original,
      id: id("content"),
      userId,
      source: "reused" as const,
      status: "draft" as const,
      scheduledAt: undefined,
      publishedAt: undefined,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      title: `${original.title} — reutilizado`,
    };
    await this.contents.update(original.id, {
      usageCount: (original.usageCount ?? 0) + 1,
    });
    await this.contents.save(copy);
    return copy;
  }

  async updateUser(
    idValue: string,
    patch: Partial<User>,
    actor: string,
    creditDelta = 0,
    reason?: string,
  ) {
    if (this.backend) {
      const current = (await this.backend.getAdminSnapshot()).users.find(
        (item) => item.id === idValue,
      );
      if (!current) throw new Error("Usuário não encontrado.");
      const snapshot = await this.backend.adminUpdateUser({
        userId: idValue,
        displayName: patch.name ?? current.name,
        systemRole:
          (patch.role ?? current.role) === "admin" ? "system_admin" : "user",
        status: patch.status ?? current.status,
        creditDelta,
        reason: reason?.trim() || `Alteração administrativa por ${actor}`,
        idempotencyKey: `admin-user:${idValue}:${crypto.randomUUID()}`,
      });
      const updated = snapshot.users.find((item) => item.id === idValue);
      if (!updated)
        throw new Error("Usuário não encontrado após atualizar.");
      return updated;
    }
    const user = await this.users.update(idValue, patch);
    await this.audit.add({
      actor,
      action: "Atualizou usuário",
      entity: user.email,
    });
    return user;
  }
  async updatePlan(idValue: Plan["id"], patch: Partial<Plan>, actor: string) {
    if (this.backend) {
      const current = (await this.backend.getAdminSnapshot()).plans.find(
        (item) => item.id === idValue,
      );
      if (!current) throw new Error("Plano não encontrado.");
      const snapshot = await this.backend.adminUpdatePlan({
        ...current,
        ...patch,
        id: idValue,
      });
      const updated = snapshot.plans.find((item) => item.id === idValue);
      if (!updated) throw new Error("Plano não encontrado após atualizar.");
      return updated;
    }
    const plan = await this.subscriptions.updatePlan(idValue, patch);
    await this.audit.add({
      actor,
      action: "Atualizou plano",
      entity: plan.name,
    });
    return plan;
  }
  async saveAiBudget(monthlyBudgetCents: number) {
    if (!this.backend)
      throw new Error("O painel de custo exige o backend Supabase configurado.");
    return this.backend.adminSaveAiBudget(monthlyBudgetCents);
  }
  async saveCreditProduct(product: CreditProduct) {
    if (!this.backend)
      throw new Error("O catÃ¡logo Stripe exige o backend Supabase configurado.");
    const snapshot = await this.backend.adminSaveCreditProduct(product);
    const saved = snapshot.creditProducts.find((item) => item.id === product.id) ??
      snapshot.creditProducts.find((item) => item.credits === product.credits);
    if (!saved) throw new Error("Pacote de crÃ©ditos nÃ£o encontrado apÃ³s salvar.");
    return saved;
  }
  async savePrompt(prompt: PromptTemplate, actor: string) {
    if (this.backend) {
      const snapshot = await this.backend.adminSavePrompt({
        ...prompt,
        updatedAt: new Date().toISOString(),
      });
      const saved = snapshot.prompts.find((item) => item.id === prompt.id);
      if (!saved) throw new Error("Prompt não encontrado após salvar.");
      return saved;
    }
    const result = await this.prompts.save({
      ...prompt,
      updatedAt: new Date().toISOString(),
    });
    await this.audit.add({
      actor,
      action: `${prompt.status === "active" ? "Ativou" : "Salvou"} prompt`,
      entity: prompt.name,
    });
    return result;
  }
  async testPrompt(
    prompt: PromptTemplate,
    sample: { brandName: string; topic: string; audience: string },
  ) {
    if (!this.backend)
      throw new Error("O playground exige o backend Supabase configurado.");
    return this.backend.adminTestPrompt(prompt, sample);
  }
  async saveTemplate(
    meta: TemplateMeta,
    spec: VisualTemplateV2,
    actor: string,
  ) {
    validateTemplate(spec);
    const saved = await this.templates.save(meta, spec);
    await this.audit.add({
      actor,
      action: "Salvou template",
      entity: saved.name,
    });
    return saved;
  }
  async importTemplates(
    file: File,
    conflict: "replace" | "rename" | "skip",
    actor: string,
  ) {
    const zip = await JSZip.loadAsync(file);
    const items: { meta: TemplateMeta; spec: VisualTemplateV2 }[] = [];
    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir || !path.endsWith(".json")) continue;
      const spec = validateTemplate(
        JSON.parse(await entry.async("string")),
      ) as VisualTemplateV2;
      const format = (
        spec.templateType === "story"
          ? "story"
          : spec.templateType === "carousel"
            ? "carousel"
            : "post"
      ) as TemplateMeta["format"];
      items.push({
        spec,
        meta: {
          id: `${format}:${spec.packageId}:${spec.templateId}`,
          templateId: spec.templateId,
          name: spec.templateName,
          format,
          packageId: spec.packageId,
          aspectRatio: spec.aspectRatio,
          width: spec.dimensions.width,
          height: spec.dimensions.height,
          path: "",
          slideType: spec.carouselSlideType,
          status: "draft",
          version: 1,
        },
      });
    }
    const imported = await this.templates.import(items, conflict);
    await this.audit.add({
      actor,
      action: `Importou ${imported.length} templates`,
      entity: file.name,
    });
    return imported;
  }
  async exportTemplate(idValue: string) {
    const meta = (await this.templates.list()).find(
      (item) => item.id === idValue,
    );
    if (!meta) throw new Error("Template não encontrado.");
    const spec = await this.templates.load(idValue);
    return {
      blob: new Blob([JSON.stringify(spec, null, 2)], {
        type: "application/json",
      }),
      filename: `${meta.templateId}.json`,
    };
  }
  async exportTemplates(formatValue: TemplateMeta["format"]) {
    const catalog = (await this.templates.list()).filter(
      (item) => item.format === formatValue,
    );
    const zip = new JSZip();
    await Promise.all(
      catalog.map(async (meta) => {
        const spec = await this.templates.load(meta.id);
        zip.file(
          `${meta.packageId}/${meta.templateId}.json`,
          JSON.stringify(spec, null, 2),
        );
      }),
    );
    const names = {
      story: "stories-all-packages.zip",
      post: "posts-all-packages.zip",
      carousel: "carousels-all-packages.zip",
    };
    return {
      blob: await zip.generateAsync({ type: "blob" }),
      filename: names[formatValue],
    };
  }
}

export const appContainer = new ApplicationContainer();
