import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  AdminSnapshot,
  AiContentDraft,
  AiGenerationRequest,
  AuditEvent,
  BrandIdentityProposal,
  BrandProfile,
  Content,
  CreditBalance,
  CreditTransaction,
  Plan,
  PromptTemplate,
  QueueItem,
  SocialAccount,
  Subscription,
  TemplateMeta,
  User,
  VisualTemplateV2,
  WeeklyPlan,
  WeeklySlot,
} from "../../domain/models";
import type {
  AuditRepository,
  AuthRepository,
  BrandAssetRepository,
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
  WeeklyPlanProgress,
  WeeklyPlanProgressSlot,
  WeeklyPlanSummary,
} from "../../domain/repositories";
import type { CreditPackageId } from "../../domain/creditRules";
import { optimizeImageFile } from "../imageProcessing";
import { getSupabaseClient, invokeSecureFunction } from "./client";
import {
  mapContent,
  mapCredits,
  mapBrand,
  mapPlan,
  mapQueue,
  mapSocial,
  mapSubscription,
  mapWorkspaceUser,
} from "./mappers";

type Row = Record<string, any>;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// America/Sao_Paulo não observa horário de verão desde 2019 — UTC-3 fixo,
// mesma simplificação usada no resto do app. Sem o offset explícito aqui,
// timestamptz no Postgres interpretava "date T time" como UTC, adiantando
// o horário agendado em 3h em relação ao que o usuário escolheu.
const scheduledAtBrazil = (date: string, time: string) =>
  `${date}T${time}:00-03:00`;

const currentWorkspace = async (): Promise<Row> => {
  const { data, error } = await getSupabaseClient().rpc("get_my_workspace");
  if (error) throw new Error(error.message);
  if (!data?.organization?.id)
    throw new Error("Workspace não encontrado para esta conta.");
  return data as Row;
};

const currentAuthUser = async () => {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  return data.user;
};

// Assina logo, logomarca e cada imagem de referência em paralelo — uma
// referência apagada/inacessível não pode derrubar login/current() inteiro,
// então cada assinatura falha isoladamente (vira undefined/entrada removida)
// em vez de propagar o erro.
const signBrandAssetPath = async (
  path: string | undefined,
): Promise<string | undefined> => {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await getSupabaseClient()
    .storage.from("brand-assets")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? undefined;
};
const withSignedBrandAssets = async (user: User): Promise<User> => {
  if (!user.brand) return user;
  const [logoUrl, logomarkUrl, referenceImageUrls] = await Promise.all([
    signBrandAssetPath(user.brand.logoUrl),
    signBrandAssetPath(user.brand.logomarkUrl),
    Promise.all(
      (user.brand.referenceImageUrls ?? []).map((path) =>
        signBrandAssetPath(path),
      ),
    ),
  ]);
  return {
    ...user,
    brand: {
      ...user.brand,
      logoUrl,
      logomarkUrl,
      referenceImageUrls: referenceImageUrls.filter(
        (url): url is string => Boolean(url),
      ),
    },
  };
};

export class SupabaseAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<User> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) throw new Error("Email ou senha incorretos.");
    const { data: workspace, error: workspaceError } =
      await client.rpc("get_my_workspace");
    if (workspaceError) throw new Error(workspaceError.message);
    const user = await withSignedBrandAssets(mapWorkspaceUser(data.user, workspace));
    if (user.status !== "active") {
      await client.auth.signOut();
      throw new Error("Esta conta está suspensa.");
    }
    return user;
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: { data: { name: input.name.trim().slice(0, 120) } },
    });
    if (error || !data.user)
      throw new Error(error?.message ?? "Não foi possível criar a conta.");
    if (!data.session)
      throw new Error(
        "Conta criada. Confirme o email enviado pelo Supabase antes de entrar.",
      );
    const { data: workspace, error: workspaceError } =
      await client.rpc("get_my_workspace");
    if (workspaceError) throw new Error(workspaceError.message);
    return withSignedBrandAssets(mapWorkspaceUser(data.user, workspace));
  }

  async loginWithGoogle(redirectTo: string): Promise<void> {
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) throw new Error(error.message);
  }

  async current(): Promise<User | undefined> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return undefined;
    const { data: workspace, error: workspaceError } =
      await client.rpc("get_my_workspace");
    if (workspaceError || !workspace) return undefined;
    const user = await withSignedBrandAssets(mapWorkspaceUser(data.user, workspace));
    if (user.status !== "active") {
      await client.auth.signOut();
      return undefined;
    }
    return user;
  }

  async logout() {
    await getSupabaseClient().auth.signOut({ scope: "local" });
  }
}

export class SupabaseUserRepository implements UserRepository {
  async list(): Promise<User[]> {
    const user = await new SupabaseAuthRepository().current();
    return user ? [user] : [];
  }
  async find(id: string): Promise<User | undefined> {
    const user = await new SupabaseAuthRepository().current();
    return user?.id === id ? user : undefined;
  }
  async update(): Promise<User> {
    throw new Error(
      "Atualizações de usuário exigem endpoint administrativo seguro.",
    );
  }
  async completeOnboarding(_id: string, brand: BrandProfile): Promise<User> {
    const { error } = await getSupabaseClient().rpc("complete_my_onboarding", {
      brand_input: brand,
    });
    if (error) throw new Error(error.message);
    const user = await new SupabaseAuthRepository().current();
    if (!user) throw new Error("Sessão inválida após o onboarding.");
    return user;
  }
}

export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  async listPlans(): Promise<Plan[]> {
    const { data, error } = await getSupabaseClient()
      .from("plans")
      .select("*")
      .order("price_cents");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapPlan);
  }
  async list(): Promise<Subscription[]> {
    const credits = await new SupabaseCreditRepository().getBalance();
    const { data, error } = await getSupabaseClient()
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapSubscription(row, credits?.available ?? 0),
    );
  }
  async findForUser(userId: string): Promise<Subscription | undefined> {
    const credits = await new SupabaseCreditRepository().getBalance();
    const { data, error } = await getSupabaseClient()
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSubscription(data, credits?.available ?? 0) : undefined;
  }
  async subscribe(): Promise<Subscription> {
    throw new Error("Checkout seguro ainda precisa do gateway de pagamento.");
  }
  async spend(): Promise<Subscription> {
    throw new Error(
      "Débitos são aceitos somente por operação validada no Supabase.",
    );
  }
  async addCredits(_userId: string, _amount: number): Promise<Subscription> {
    void _userId;
    void _amount;
    throw new Error(
      "Créditos são concedidos somente por webhook de pagamento confirmado.",
    );
  }
  async updatePlan(): Promise<Plan> {
    throw new Error(
      "Alteração de plano exige endpoint administrativo com MFA.",
    );
  }
}

const allowedUploadTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

export class SupabaseMediaRepository implements MediaRepository {
  async upload(files: File[]): Promise<string[]> {
    if (files.length < 1 || files.length > 10)
      throw new Error("Selecione entre 1 e 10 arquivos.");
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 100 * 1024 * 1024)
      throw new Error("Os arquivos devem somar no máximo 100 MB.");
    const [workspace, auth] = await Promise.all([
      currentWorkspace(),
      currentAuthUser(),
    ]);
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const extension = allowedUploadTypes[file.type];
        if (!extension) throw new Error("Formato de arquivo não permitido.");
        if (file.size <= 0 || file.size > 100 * 1024 * 1024)
          throw new Error("Arquivo vazio ou acima do limite de 100 MB.");
        const objectPath = `${workspace.organization.id}/${auth.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await getSupabaseClient()
          .storage.from("content-uploads")
          .upload(objectPath, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (error) throw new Error(error.message);
        uploaded.push(objectPath);
      }
      return uploaded.map((path) => `content-uploads/${path}`);
    } catch (error) {
      if (uploaded.length)
        await getSupabaseClient()
          .storage.from("content-uploads")
          .remove(uploaded);
      throw error;
    }
  }
}

const brandAssetUploadTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MAX_BRAND_ASSET_BYTES = 10 * 1024 * 1024;

export class SupabaseBrandAssetRepository implements BrandAssetRepository {
  private async uploadToPath(
    rawFile: File,
    path: string,
    options: { forceJpeg?: boolean } = {},
  ): Promise<string> {
    const file = await optimizeImageFile(rawFile, options);
    const extension = brandAssetUploadTypes[file.type];
    if (!extension) throw new Error("Formato de imagem não permitido.");
    if (file.size <= 0 || file.size > MAX_BRAND_ASSET_BYTES)
      throw new Error("Arquivo vazio ou acima do limite de 10 MB.");
    const objectPath = `${path}.${extension}`;
    const { error } = await getSupabaseClient()
      .storage.from("brand-assets")
      .upload(objectPath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });
    if (error) throw new Error(error.message);
    return objectPath;
  }
  async uploadLogo(file: File): Promise<string> {
    const workspace = await currentWorkspace();
    // Preserva o formato original (PNG/WEBP) para não perder transparência.
    return this.uploadToPath(file, `${workspace.organization.id}/brand/logo`);
  }
  async uploadLogomark(file: File): Promise<string> {
    const workspace = await currentWorkspace();
    return this.uploadToPath(
      file,
      `${workspace.organization.id}/brand/logomark`,
    );
  }
  async uploadReferenceImage(file: File): Promise<string> {
    const workspace = await currentWorkspace();
    // Referência de estilo é sempre uma foto/composição — pode virar JPEG.
    return this.uploadToPath(
      file,
      `${workspace.organization.id}/brand/references/${crypto.randomUUID()}`,
      { forceJpeg: true },
    );
  }
}

const contentRow = (content: Content, workspace: Row, userId: string) => ({
  organization_id: workspace.organization.id,
  brand_id: workspace.brand?.id ?? null,
  user_id: userId,
  title: content.title,
  format: content.format,
  source: content.source,
  status: content.status,
  topic: content.topic,
  caption: content.caption,
  hashtags: content.hashtags,
  cta: content.cta,
  alt_text: content.altText ?? null,
  location: content.location ?? null,
  link: content.link ?? null,
  first_comment: content.firstComment ?? null,
  collaborators: content.collaborators ?? [],
  tagged_people: content.taggedPeople ?? [],
  scheduled_at: content.scheduledAt ?? null,
  published_at: content.publishedAt ?? null,
  media_paths: content.mediaStoragePaths ?? content.mediaUrls,
  slide_texts: content.slideTexts ?? null,
  reel_script: content.reelScript ?? null,
  template_path: content.templatePath ?? null,
  social_account_ids: (content.socialAccountIds ?? []).filter((id) =>
    uuidPattern.test(id),
  ),
  tags: content.tags ?? [],
  favorite: content.favorite ?? false,
  folder: content.folder ?? null,
  usage_count: content.usageCount ?? 0,
  failure_reason: content.failureReason ?? null,
});

export class SupabaseContentRepository implements ContentRepository {
  private async hydrate(row: Row): Promise<Content> {
    const content = mapContent(row);
    const paths = content.mediaStoragePaths ?? [];
    content.mediaUrls = await Promise.all(
      paths.map(async (storedPath) => {
        const [candidateBucket, ...rest] = storedPath
          .replace(/^\//, "")
          .split("/");
        const bucket = [
          "content-uploads",
          "generated-media",
          "content-renders",
        ].includes(candidateBucket)
          ? candidateBucket
          : "content-renders";
        const objectPath =
          bucket === candidateBucket ? rest.join("/") : storedPath;
        const { data } = await getSupabaseClient()
          .storage.from(bucket)
          .createSignedUrl(objectPath, 60 * 60);
        return data?.signedUrl ?? storedPath;
      }),
    );
    return content;
  }

  async list(userId?: string): Promise<Content[]> {
    let query = getSupabaseClient()
      .from("contents")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return Promise.all((data ?? []).map((row) => this.hydrate(row)));
  }
  async find(id: string): Promise<Content | undefined> {
    if (!uuidPattern.test(id)) return undefined;
    const { data, error } = await getSupabaseClient()
      .from("contents")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.hydrate(data) : undefined;
  }
  async save(content: Content): Promise<Content> {
    const [workspace, auth] = await Promise.all([
      currentWorkspace(),
      currentAuthUser(),
    ]);
    const payload = contentRow(content, workspace, auth.id);
    const result = uuidPattern.test(content.id)
      ? await getSupabaseClient()
          .from("contents")
          .upsert({ id: content.id, ...payload })
          .select()
          .single()
      : await getSupabaseClient()
          .from("contents")
          .insert(payload)
          .select()
          .single();
    if (result.error) throw new Error(result.error.message);
    return this.hydrate(result.data);
  }
  async update(id: string, patch: Partial<Content>): Promise<Content> {
    const current = await this.find(id);
    if (!current) throw new Error("Conteúdo não encontrado.");
    const [workspace, auth] = await Promise.all([
      currentWorkspace(),
      currentAuthUser(),
    ]);
    const { data, error } = await getSupabaseClient()
      .from("contents")
      .update(contentRow({ ...current, ...patch }, workspace, auth.id))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return this.hydrate(data);
  }
  async remove(id: string) {
    const { error } = await getSupabaseClient()
      .from("contents")
      .update({ deleted_at: new Date().toISOString(), status: "canceled" })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export class SupabasePlannerRepository implements PlannerRepository {
  async save(plan: WeeklyPlan): Promise<WeeklyPlan> {
    const [workspace, auth] = await Promise.all([
      currentWorkspace(),
      currentAuthUser(),
    ]);
    const { data, error } = await getSupabaseClient()
      .from("weekly_plans")
      .insert({
        organization_id: workspace.organization.id,
        brand_id: workspace.brand?.id ?? null,
        user_id: auth.id,
        week_start: plan.weekStart,
        status: plan.status,
        confirmed_at:
          plan.status === "confirmed" ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (plan.slots.length) {
      const slots = plan.slots.map((slot, position) => ({
        organization_id: workspace.organization.id,
        weekly_plan_id: data.id,
        day: slot.date,
        local_time: slot.time,
        scheduled_at: scheduledAtBrazil(slot.date, slot.time),
        format: slot.format,
        source: slot.source,
        topic: slot.topic,
        quantity: slot.quantity ?? 1,
        slides: slot.slides,
        library_content_id: uuidPattern.test(slot.libraryContentId ?? "")
          ? slot.libraryContentId
          : null,
        estimated_credits: slot.cost,
        position,
      }));
      const inserted = await getSupabaseClient()
        .from("weekly_slots")
        .insert(slots);
      if (inserted.error) throw new Error(inserted.error.message);
    }
    return { ...plan, id: data.id };
  }
  async list(userId: string): Promise<WeeklyPlan[]> {
    const { data, error } = await getSupabaseClient()
      .from("weekly_plans")
      .select("*,weekly_slots(*)")
      .eq("user_id", userId)
      .order("week_start", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      weekStart: row.week_start,
      status: row.status,
      slots: (row.weekly_slots ?? []).map((slot: Row) => ({
        id: slot.id,
        format: slot.format,
        source: slot.source,
        topic: slot.topic,
        date: slot.day,
        time: String(slot.local_time).slice(0, 5),
        quantity: slot.quantity,
        slides: slot.slides,
        libraryContentId: slot.library_content_id ?? undefined,
        cost: slot.estimated_credits,
      })),
    }));
  }
  // Cobre tanto o banner de "planejamento em andamento" (filtra pending>0)
  // quanto o histórico completo — mesma fonte, sem duplicar a query.
  async listWeeklyPlanSummaries(userId: string): Promise<WeeklyPlanSummary[]> {
    const { data, error } = await getSupabaseClient()
      .from("weekly_plans")
      .select("id,week_start,status,weekly_slots(status)")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .order("week_start", { ascending: false })
      .limit(52);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const slots = (row.weekly_slots ?? []) as Array<{ status: string }>;
      const total = slots.length;
      const completed = slots.filter((slot) => slot.status === "completed").length;
      const failed = slots.filter((slot) => slot.status === "failed").length;
      return {
        planId: row.id,
        weekStart: row.week_start,
        total,
        completed,
        failed,
        pending: total - completed - failed,
      };
    });
  }
  async createPendingWeeklyPlan(input: {
    userId: string;
    weekStart: string;
    items: Array<{
      date: string;
      time: string;
      scheduled?: boolean;
      format: WeeklySlot["format"];
      source: WeeklySlot["source"];
      topic: string;
      slides: number;
      cost: number;
      libraryContentId?: string;
      draft?: Record<string, unknown>;
    }>;
  }): Promise<{ planId: string; slotIds: string[] }> {
    const workspace = await currentWorkspace();
    const { data: plan, error } = await getSupabaseClient()
      .from("weekly_plans")
      .insert({
        organization_id: workspace.organization.id,
        brand_id: workspace.brand?.id ?? null,
        user_id: input.userId,
        week_start: input.weekStart,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!input.items.length) return { planId: plan.id, slotIds: [] };
    const rows = input.items.map((item, position) => ({
      organization_id: workspace.organization.id,
      weekly_plan_id: plan.id,
      day: item.date,
      local_time: item.time,
      scheduled_at:
        item.scheduled === false ? null : scheduledAtBrazil(item.date, item.time),
      format: item.format,
      source: item.source,
      topic: item.topic,
      quantity: 1,
      slides: item.slides,
      library_content_id: uuidPattern.test(item.libraryContentId ?? "")
        ? item.libraryContentId
        : null,
      estimated_credits: item.cost,
      position,
      status: "pending",
      draft: item.draft ?? {},
    }));
    const { data: slots, error: slotsError } = await getSupabaseClient()
      .from("weekly_slots")
      .insert(rows)
      .select("id,position");
    if (slotsError) throw new Error(slotsError.message);
    const slotIds = input.items.map(
      (_, position) => slots!.find((row) => row.position === position)!.id,
    );
    return { planId: plan.id, slotIds };
  }
  async resolveWeeklySlot(slotId: string, contentId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("weekly_slots")
      .update({ status: "completed", content_id: contentId })
      .eq("id", slotId);
    if (error) throw new Error(error.message);
  }
  async retryWeeklySlot(slotId: string): Promise<void> {
    // attempts: 0 — sem isso, um slot que já bateu o teto de tentativas
    // automáticas (MAX_ATTEMPTS em process-weekly-slots) falhava de novo na
    // hora ao clicar "Tentar novamente", sem sequer tentar gerar.
    const { error } = await getSupabaseClient()
      .from("weekly_slots")
      .update({ status: "pending", error_code: null, locked_at: null, attempts: 0 })
      .eq("id", slotId)
      .eq("status", "failed");
    if (error) throw new Error(error.message);
  }
  async getWeeklyPlanProgress(planId: string): Promise<WeeklyPlanProgress> {
    const { data: plan, error } = await getSupabaseClient()
      .from("weekly_plans")
      .select("id,week_start,status,weekly_slots(*)")
      .eq("id", planId)
      .single();
    if (error) throw new Error(error.message);
    const contentRepository = new SupabaseContentRepository();
    const slots = await Promise.all(
      (plan.weekly_slots ?? [])
        .sort((a: Row, b: Row) => Number(a.position) - Number(b.position))
        .map(async (slot: Row) => ({
          id: slot.id as string,
          date: slot.day as string,
          time: String(slot.local_time).slice(0, 5),
          format: slot.format as WeeklySlot["format"],
          source: slot.source as WeeklySlot["source"],
          topic: slot.topic as string,
          status: slot.status as WeeklyPlanProgressSlot["status"],
          errorCode: slot.error_code ?? undefined,
          content: slot.content_id
            ? await contentRepository.find(slot.content_id as string)
            : undefined,
        })),
    );
    return {
      planId: plan.id,
      weekStart: plan.week_start,
      status: plan.status,
      slots,
    };
  }
  subscribeToWeeklyPlanProgress(planId: string, onChange: () => void): () => void {
    const client = getSupabaseClient();
    let channel: RealtimeChannel | undefined = client
      .channel(`weekly-plan-progress:${planId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekly_slots",
          filter: `weekly_plan_id=eq.${planId}`,
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      if (channel) {
        void client.removeChannel(channel);
        channel = undefined;
      }
    };
  }
}

export class SupabaseQueueRepository implements PublishingQueueRepository {
  async list(): Promise<QueueItem[]> {
    const { data, error } = await getSupabaseClient()
      .from("publishing_jobs")
      .select("*,contents!inner(user_id)")
      .order("scheduled_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapQueue);
  }
  async enqueue(): Promise<QueueItem[]> {
    throw new Error(
      "Agendamentos devem ser criados pela Edge Function segura.",
    );
  }
  async update(): Promise<QueueItem> {
    throw new Error("Mudanças na fila exigem uma Edge Function segura.");
  }
}

export class SupabasePromptRepository implements PromptRepository {
  async list(): Promise<PromptTemplate[]> {
    const { data, error } = await getSupabaseClient()
      .from("prompt_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      task: row.task,
      format: row.format,
      version: row.version,
      status: row.status,
      systemPrompt: row.system_prompt,
      userPrompt: row.user_prompt,
      variables: row.variables ?? [],
      packages: row.packages ?? [],
      outputSchema: JSON.stringify(row.output_schema ?? {}, null, 2),
      updatedAt: row.updated_at,
    }));
  }
  async save(): Promise<PromptTemplate> {
    throw new Error("Prompts exigem endpoint administrativo com MFA.");
  }
  async remove(): Promise<void> {
    throw new Error("Prompts exigem endpoint administrativo com MFA.");
  }
}

const mapTemplateMeta = (row: Row): TemplateMeta => ({
  id: row.template_key,
  templateId: String(row.template_key).split(":").at(-1) ?? row.template_key,
  name: row.name,
  format: row.format,
  packageId: row.package_id,
  aspectRatio: row.aspect_ratio,
  width: Number(row.width),
  height: Number(row.height),
  path: row.spec_path,
  status: row.status,
  version: Number(row.active_version ?? 1),
});

export class SupabaseTemplateRepository implements TemplateRepository {
  async list(): Promise<TemplateMeta[]> {
    const { data, error } = await getSupabaseClient()
      .from("visual_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapTemplateMeta);
  }
  async load(id: string): Promise<VisualTemplateV2> {
    const response = await invokeSecureFunction<{ spec: VisualTemplateV2 }>(
      "template-api",
      { action: "load", templateKey: id },
    );
    return response.spec;
  }
  async save(meta: TemplateMeta, spec: VisualTemplateV2): Promise<TemplateMeta> {
    await invokeSecureFunction("template-api", {
      action: "save",
      item: { meta: { ...meta, path: undefined }, spec },
    });
    const saved = (await this.list()).find((item) => item.id === meta.id);
    if (!saved) throw new Error("Template não encontrado após salvar.");
    return saved;
  }
  async import(
    items: { meta: TemplateMeta; spec: VisualTemplateV2 }[],
    conflict: "replace" | "rename" | "skip",
  ): Promise<TemplateMeta[]> {
    for (let index = 0; index < items.length; index += 10) {
      await invokeSecureFunction("template-api", {
        action: "import",
        conflict,
        items: items.slice(index, index + 10).map((item) => ({
          meta: { ...item.meta, path: undefined },
          spec: item.spec,
        })),
      });
    }
    const catalog = await this.list();
    const requested = new Set(items.map((item) => item.meta.id));
    return catalog.filter((item) => requested.has(item.id));
  }
}

export class SupabaseSocialAccountRepository
  implements SocialAccountRepository
{
  async list(userId: string): Promise<SocialAccount[]> {
    const { data, error } = await getSupabaseClient()
      .from("social_accounts")
      .select(
        "id,user_id,network,handle,display_name,avatar_url,status,token_expires_at,account_type,biography,followers_count,media_count",
      )
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSocial);
  }
  async update(): Promise<SocialAccount> {
    throw new Error(
      "Conexões sociais são alteradas somente pelo fluxo OAuth seguro.",
    );
  }
}

export class SupabaseAuditRepository implements AuditRepository {
  async list(): Promise<AuditEvent[]> {
    const { data, error } = await getSupabaseClient()
      .from("audit_logs")
      .select("id,actor_user_id,action,entity_type,entity_id,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      actor: row.actor_user_id ?? "system",
      action: row.action,
      entity: `${row.entity_type}:${row.entity_id ?? ""}`,
      at: row.created_at,
    }));
  }
  async add(): Promise<AuditEvent> {
    throw new Error("Auditoria é gravada somente pelo backend.");
  }
}

export class SupabaseCreditRepository implements CreditRepository {
  async getBalance(): Promise<CreditBalance | undefined> {
    const { data, error } = await getSupabaseClient().rpc(
      "get_my_credit_balance",
    );
    if (error) throw new Error(error.message);
    return mapCredits(data?.[0]);
  }
  subscribe(
    organizationId: string,
    onBalance: (balance: CreditBalance) => void,
  ): () => void {
    const client = getSupabaseClient();
    let channel: RealtimeChannel | undefined = client
      .channel(`credit-wallet:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "credit_wallets",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const balance = mapCredits(payload.new);
          if (balance) onBalance(balance);
        },
      )
      .subscribe();
    return () => {
      if (channel) {
        void client.removeChannel(channel);
        channel = undefined;
      }
    };
  }
  async listTransactions(days: number): Promise<CreditTransaction[]> {
    const workspace = await currentWorkspace();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getSupabaseClient()
      .from("credit_transactions")
      .select("id,type,balance_delta,balance_after,reference_type,created_at")
      .eq("organization_id", workspace.organization.id)
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      balanceDelta: row.balance_delta,
      balanceAfter: row.balance_after,
      referenceType: row.reference_type ?? undefined,
      createdAt: row.created_at,
    }));
  }
}

export class SupabaseBackendGateway implements SecureBackendGateway {
  async generateWeeklyPlan(input: {
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
    const response = await invokeSecureFunction<{ slots: WeeklySlot[] }>(
      "ai-weekly-plan",
      input,
    );
    return response.slots;
  }
  async previewAiContent(input: AiGenerationRequest & { slides?: number }) {
    const response = await invokeSecureFunction<{ drafts: AiContentDraft[] }>(
      "ai-content-preview",
      {
        objective: input.objective,
        topic: input.topic,
        format: input.format,
        style: input.style,
        instructions: input.instructions,
        variations: input.variations,
        slides: input.slides,
      },
    );
    return response.drafts;
  }
  async generateAiContent(input: {
    idempotencyKey: string;
    title?: string;
    topic: string;
    objective?: string;
    style?: string;
    instructions?: string;
    format: Content["format"];
    slides?: number;
    caption?: string;
    hashtags?: string[];
    cta?: string;
    slideTexts?: string[];
    reelScript?: Content["reelScript"];
    scheduledAt?: string;
    timezone?: string;
    socialAccountId?: string;
  }) {
    const response = await invokeSecureFunction<{
      contentId: string;
      jobId?: string;
      creditBalance: Row;
      chargedCredits: number;
    }>("ai-content-generate", input);
    const credits = mapCredits(response.creditBalance);
    if (!credits) throw new Error("Saldo inválido retornado pela geração.");
    return {
      contentId: response.contentId,
      jobId: response.jobId,
      credits,
      chargedCredits: response.chargedCredits,
    };
  }
  async queueAction(
    input:
      | {
          action: "reschedule";
          jobId: string;
          scheduledAt: string;
          timezone: string;
        }
      | { action: "cancel" | "retry"; jobId: string },
  ) {
    await invokeSecureFunction("queue-action", input);
  }

  private mapAdminSnapshot(raw: Row): AdminSnapshot {
    const authById = new Map((raw.authUsers ?? []).map((item: Row) => [item.id, item]));
    const membershipByUser = new Map((raw.memberships ?? []).map((item: Row) => [item.user_id, item]));
    const organizationById = new Map((raw.organizations ?? []).map((item: Row) => [item.id, item]));
    const brandByOrganization = new Map((raw.brands ?? []).map((item: Row) => [item.organization_id, item]));
    const walletByOrganization = new Map((raw.wallets ?? []).map((item: Row) => [item.organization_id, item]));
    const users = (raw.profiles ?? []).map((profile: Row) => {
      const auth = authById.get(profile.id) as Row | undefined;
      const membership = membershipByUser.get(profile.id) as Row | undefined;
      const organization = organizationById.get(membership?.organization_id) as Row | undefined;
      return {
        id: profile.id,
        organizationId: organization?.id,
        name: profile.display_name,
        email: auth?.email ?? "",
        role: profile.system_role === "system_admin" ? "admin" : "user",
        status: profile.status === "suspended" ? "suspended" : "active",
        onboardingCompleted: Boolean(profile.onboarding_completed_at),
        brand: mapBrand(brandByOrganization.get(organization?.id) as Row | undefined),
        createdAt: profile.created_at,
        lastSignInAt: auth?.lastSignInAt ?? undefined,
        authProviders: auth?.providers ?? [],
      } satisfies User;
    });
    const subscriptions = (raw.subscriptions ?? []).map((row: Row) =>
      mapSubscription(
        row,
        Number((walletByOrganization.get(row.organization_id) as Row | undefined)?.balance ?? 0) -
          Number((walletByOrganization.get(row.organization_id) as Row | undefined)?.reserved ?? 0),
      ),
    );
    return {
      users,
      plans: (raw.plans ?? []).map(mapPlan),
      creditProducts: (raw.creditProducts ?? []).map((row: Row) => ({
        id: row.id,
        name: row.name,
        credits: Number(row.credits),
        price: Number(row.price_cents) / 100,
        available: Boolean(row.available),
        featured: Boolean(row.featured),
        position: Number(row.position ?? 0),
      })),
      subscriptions,
      contents: (raw.contents ?? []).map(mapContent),
      queue: (raw.jobs ?? []).map(mapQueue),
      prompts: (raw.prompts ?? []).map((row: Row) => ({
        id: row.id,
        name: row.name,
        task: row.task,
        format: row.format,
        version: row.version,
        status: row.status,
        systemPrompt: row.system_prompt,
        userPrompt: row.user_prompt,
        variables: row.variables ?? [],
        packages: row.packages ?? [],
        outputSchema: JSON.stringify(row.output_schema ?? {}, null, 2),
        updatedAt: row.updated_at,
      })),
      audit: (raw.audit ?? []).map((row: Row) => ({
        id: row.id,
        actor: row.actor_user_id ?? "system",
        action: row.action,
        entity: `${row.entity_type}:${row.entity_id ?? ""}`,
        at: row.created_at,
      })),
      templates: (raw.templates ?? []).map(mapTemplateMeta),
      aiUsage: (raw.aiUsage ?? []).map((row: Row) => ({
        organizationId: row.organization_id,
        format: row.format,
        totalTokens: Number(row.total_tokens ?? 0),
        inputTokens: Number(row.input_tokens ?? 0),
        outputTokens: Number(row.output_tokens ?? 0),
        costMillicents: Number(row.cost_millicents ?? 0),
        creditsCharged: Number(row.credits_charged ?? 0),
        apiCalls: Number(row.api_calls ?? 0),
        createdAt: row.created_at,
      })),
      aiMonthlyBudgetCents: Number(raw.aiMonthlyBudgetCents ?? 0),
    };
  }
  private async admin(input: Row): Promise<AdminSnapshot> {
    const response = await invokeSecureFunction<{ snapshot: Row }>("admin-api", input);
    return this.mapAdminSnapshot(response.snapshot);
  }
  async getAdminSnapshot() {
    return this.admin({ action: "snapshot" });
  }
  async adminSaveAiBudget(monthlyBudgetCents: number) {
    return this.admin({ action: "save-ai-budget", monthlyBudgetCents });
  }
  async adminUpdateUser(input: {
    userId: string;
    displayName: string;
    systemRole: "user" | "system_admin";
    status: "active" | "suspended";
    creditDelta: number;
    reason: string;
    idempotencyKey: string;
  }) {
    return this.admin({ action: "update-user", ...input });
  }
  async adminUpdatePlan(plan: Plan) {
    return this.admin({
      action: "update-plan",
      planId: plan.id,
      patch: {
        name: plan.name,
        priceCents: Math.round(plan.price * 100),
        credits: plan.credits,
        durationDays: plan.durationDays,
        available: plan.available,
        featured: Boolean(plan.featured),
        badge: plan.badge ?? null,
      },
      idempotencyKey: crypto.randomUUID(),
    });
  }
  async adminSaveCreditProduct(product: import("../../domain/models").CreditProduct) {
    return this.admin({
      action: "save-credit-product",
      product: {
        id: product.id || undefined,
        name: product.name,
        credits: product.credits,
        priceCents: Math.round(product.price * 100),
        available: product.available,
        featured: product.featured,
        position: product.position,
      },
      idempotencyKey: crypto.randomUUID(),
    });
  }
  async adminSavePrompt(prompt: PromptTemplate) {
    return this.admin({ action: "save-prompt", prompt });
  }
  async adminArchivePrompt(promptId: string) {
    return this.admin({ action: "archive-prompt", promptId });
  }
  async adminTestPrompt(
    prompt: PromptTemplate,
    sample: { brandName: string; topic: string; audience: string },
  ) {
    return invokeSecureFunction<{ result: unknown; model: string }>(
      "admin-api",
      { action: "test-prompt", prompt, sample },
    );
  }
  async scheduleContent(input: {
    contentId: string;
    scheduledAt: string;
    timezone: string;
    socialAccountId?: string;
    idempotencyKey: string;
  }) {
    const response = await invokeSecureFunction<{
      result: Row;
      chargedCredits: number;
    }>("schedule-content", input);
    const credits = mapCredits(response.result);
    if (!credits || !response.result?.job_id)
      throw new Error("Resposta inválida do backend de agendamento.");
    return {
      jobId: response.result.job_id,
      credits,
      chargedCredits: response.chargedCredits,
    };
  }
  async createCheckout(
    input:
      | {
          kind: "subscription";
          planId: "month" | "year";
          idempotencyKey: string;
        }
      | {
          kind: "credit_pack";
          creditProductId: string;
          idempotencyKey: string;
        },
  ) {
    return invokeSecureFunction<{ checkoutUrl: string; sessionId: string }>(
      "billing-create-checkout",
      input,
    );
  }
  async createBillingPortal() {
    return invokeSecureFunction<{ portalUrl: string }>(
      "billing-create-portal",
      {},
    );
  }
  async startMetaOAuth(returnPath = "/social-accounts") {
    return invokeSecureFunction<{ authorizationUrl: string }>(
      "meta-oauth-start",
      { returnPath },
    );
  }
  async disconnectMeta(socialAccountId: string) {
    await invokeSecureFunction<{ disconnected: boolean }>("meta-disconnect", {
      socialAccountId,
    });
  }
  async analyzeInstagramBrand(input: {
    brandId: string;
    socialAccountId: string;
    applyAutomatically?: boolean;
  }) {
    return invokeSecureFunction<{
      jobId: string;
      status: "review" | "applied";
      proposal: BrandIdentityProposal;
    }>("brand-analyze-instagram", {
      ...input,
      applyAutomatically: input.applyAutomatically ?? true,
    });
  }
}

export const assertNoDirectCreditPackageGrant = (
  _packageId: CreditPackageId,
) => {
  void _packageId;
  throw new Error(
    "A compra será efetivada somente após confirmação do gateway de pagamento.",
  );
};
