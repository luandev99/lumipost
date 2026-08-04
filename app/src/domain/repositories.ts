import type {
  AiContentDraft,
  AiGenerationRequest,
  AdminSnapshot,
  CreditProduct,
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
} from "./models";

export interface AuthRepository {
  login(email: string, password: string): Promise<User>;
  loginWithGoogle(redirectTo: string): Promise<void>;
  register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<User>;
  current(): Promise<User | undefined>;
  logout(): Promise<void>;
}
export interface UserRepository {
  list(): Promise<User[]>;
  find(id: string): Promise<User | undefined>;
  update(id: string, patch: Partial<User>): Promise<User>;
  completeOnboarding(id: string, brand: BrandProfile): Promise<User>;
}
export interface SubscriptionRepository {
  listPlans(): Promise<Plan[]>;
  list(): Promise<Subscription[]>;
  findForUser(userId: string): Promise<Subscription | undefined>;
  subscribe(userId: string, planId: Plan["id"]): Promise<Subscription>;
  spend(userId: string, amount: number): Promise<Subscription>;
  addCredits(userId: string, amount: number): Promise<Subscription>;
  updatePlan(id: Plan["id"], patch: Partial<Plan>): Promise<Plan>;
}
export interface ContentRepository {
  list(userId?: string): Promise<Content[]>;
  find(id: string): Promise<Content | undefined>;
  save(content: Content): Promise<Content>;
  update(id: string, patch: Partial<Content>): Promise<Content>;
  remove(id: string): Promise<void>;
}
export interface WeeklyPlanProgressSlot {
  id: string;
  date: string;
  time: string;
  format: WeeklySlot["format"];
  source: WeeklySlot["source"];
  topic: string;
  status: "pending" | "processing" | "completed" | "failed";
  errorCode?: string;
  content?: Content;
}
export interface WeeklyPlanProgress {
  planId: string;
  weekStart: string;
  status: "draft" | "review" | "confirmed" | "canceled";
  slots: WeeklyPlanProgressSlot[];
}
export interface WeeklyPlanSummary {
  planId: string;
  weekStart: string;
  total: number;
  completed: number;
  failed: number;
  pending: number;
}
export interface PlannerRepository {
  save(plan: WeeklyPlan): Promise<WeeklyPlan>;
  list(userId: string): Promise<WeeklyPlan[]>;
  listWeeklyPlanSummaries(userId: string): Promise<WeeklyPlanSummary[]>;
  createPendingWeeklyPlan(input: {
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
      draft?: {
        objective?: string;
        style?: string;
        instructions?: string;
        title?: string;
        caption?: string;
        hashtags?: string[];
        cta?: string;
        slideTexts?: string[];
        reelScript?: Content["reelScript"];
        socialAccountId?: string;
        referenceImagePath?: string;
        referenceMode?: "base" | "context";
        useBrandLogo?: boolean;
      };
    }>;
  }): Promise<{ planId: string; slotIds: string[] }>;
  resolveWeeklySlot(slotId: string, contentId: string): Promise<void>;
  getWeeklyPlanProgress(planId: string): Promise<WeeklyPlanProgress>;
  retryWeeklySlot(slotId: string): Promise<void>;
  subscribeToWeeklyPlanProgress(planId: string, onChange: () => void): () => void;
}
export interface TemplateRepository {
  list(): Promise<TemplateMeta[]>;
  load(id: string): Promise<VisualTemplateV2>;
  save(meta: TemplateMeta, spec: VisualTemplateV2): Promise<TemplateMeta>;
  import(
    items: { meta: TemplateMeta; spec: VisualTemplateV2 }[],
    conflict: "replace" | "rename" | "skip",
  ): Promise<TemplateMeta[]>;
}
export interface PromptRepository {
  list(): Promise<PromptTemplate[]>;
  save(prompt: PromptTemplate): Promise<PromptTemplate>;
  remove(id: string): Promise<void>;
}
export interface PublishingQueueRepository {
  list(): Promise<QueueItem[]>;
  enqueue(items: QueueItem[]): Promise<QueueItem[]>;
  update(id: string, patch: Partial<QueueItem>): Promise<QueueItem>;
}
export interface AuditRepository {
  list(): Promise<AuditEvent[]>;
  add(event: Omit<AuditEvent, "id" | "at">): Promise<AuditEvent>;
}
export interface AiGenerationRepository {
  preview(
    request: AiGenerationRequest,
    brand?: BrandProfile,
  ): Promise<AiContentDraft[]>;
}
export interface SocialAccountRepository {
  list(userId: string): Promise<SocialAccount[]>;
  update(id: string, patch: Partial<SocialAccount>): Promise<SocialAccount>;
}
export interface CreditRepository {
  getBalance(): Promise<CreditBalance | undefined>;
  subscribe(
    organizationId: string,
    onBalance: (balance: CreditBalance) => void,
  ): () => void;
  listTransactions(days: number): Promise<CreditTransaction[]>;
}
export interface MediaRepository {
  upload(files: File[]): Promise<string[]>;
}
export interface SecureBackendGateway {
  generateWeeklyPlan(input: {
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
  }): Promise<WeeklySlot[]>;
  previewAiContent(input: AiGenerationRequest & { slides?: number }): Promise<AiContentDraft[]>;
  generateAiContent(input: {
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
  }): Promise<{
    contentId: string;
    jobId?: string;
    credits: CreditBalance;
    chargedCredits: number;
  }>;
  queueAction(input:
    | { action: "reschedule"; jobId: string; scheduledAt: string; timezone: string }
    | { action: "cancel" | "retry"; jobId: string }
  ): Promise<void>;
  getAdminSnapshot(): Promise<AdminSnapshot>;
  adminUpdateUser(input: {
    userId: string;
    displayName: string;
    systemRole: "user" | "system_admin";
    status: "active" | "suspended";
    creditDelta: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<AdminSnapshot>;
  adminUpdatePlan(plan: Plan): Promise<AdminSnapshot>;
  adminSaveAiBudget(monthlyBudgetCents: number): Promise<AdminSnapshot>;
  adminSaveCreditProduct(product: CreditProduct): Promise<AdminSnapshot>;
  adminSavePrompt(prompt: PromptTemplate): Promise<AdminSnapshot>;
  adminArchivePrompt(promptId: string): Promise<AdminSnapshot>;
  adminTestPrompt(
    prompt: PromptTemplate,
    sample: { brandName: string; topic: string; audience: string },
  ): Promise<{ result: unknown; model: string }>;
  scheduleContent(input: {
    contentId: string;
    scheduledAt: string;
    timezone: string;
    socialAccountId?: string;
    idempotencyKey: string;
  }): Promise<{
    jobId: string;
    credits: CreditBalance;
    chargedCredits: number;
  }>;
  createCheckout(
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
  ): Promise<{ checkoutUrl: string; sessionId: string }>;
  createBillingPortal(): Promise<{ portalUrl: string }>;
  startMetaOAuth(returnPath?: string): Promise<{ authorizationUrl: string }>;
  disconnectMeta(socialAccountId: string): Promise<void>;
  analyzeInstagramBrand(input: {
    brandId: string;
    socialAccountId: string;
    applyAutomatically?: boolean;
  }): Promise<{
    jobId: string;
    status: "review" | "applied";
    proposal: BrandIdentityProposal;
  }>;
}
