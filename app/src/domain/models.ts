export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended";
export type ContentFormat =
  | "post"
  | "carousel"
  | "story"
  | "reel"
  | "video"
  | "caption";
export type ContentSource = "ai" | "manual" | "upload" | "library" | "reused";
export type ContentStatus =
  | "draft"
  | "generating"
  | "awaiting_approval"
  | "scheduled"
  | "processing"
  | "publishing"
  | "published"
  | "failed"
  | "paused"
  | "canceled";
export type QueueStatus =
  | "scheduled"
  | "processing"
  | "publishing"
  | "published"
  | "failed"
  | "paused"
  | "canceled";
export type SocialNetwork = "instagram" | "facebook" | "tiktok" | "linkedin";
export type ThemeMode = "light" | "dark";

export interface BrandProfile {
  id?: string;
  brandName: string;
  description: string;
  industry: string;
  specialty: string;
  audience: string;
  goals: string[];
  contentTypes: ContentFormat[];
  personality: string[];
  tone: string[];
  logoUrl?: string;
  logomarkUrl?: string;
  referenceImageUrls?: string[];
  businessType?: string;
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  visualStyle: string;
  instagram: string;
  instagramConnected: boolean;
}

export interface User {
  id: string;
  organizationId?: string;
  name: string;
  email: string;
  /** Used only by the isolated in-memory demo; Supabase never returns a password. */
  password?: string;
  role: UserRole;
  status: UserStatus;
  onboardingCompleted: boolean;
  brand?: BrandProfile;
  subscriptionId?: string;
  createdAt: string;
  lastSignInAt?: string;
  authProviders?: string[];
}

export interface Plan {
  id: "week" | "month" | "year";
  name: string;
  price: number;
  credits: number;
  durationDays: number;
  available: boolean;
  featured?: boolean;
  badge?: string;
  installments?: { count: number; value: number };
}

export interface CreditProduct {
  id: string;
  name: string;
  credits: number;
  price: number;
  available: boolean;
  featured: boolean;
  position: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: Plan["id"];
  status: "active" | "canceled";
  credits: number;
  startsAt: string;
  expiresAt: string;
}

export interface CreditBalance {
  organizationId: string;
  balance: number;
  reserved: number;
  available: number;
  version: number;
  syncedAt: string;
}

export type CreditTransactionType =
  | "grant"
  | "purchase"
  | "reserve"
  | "consume"
  | "release"
  | "refund"
  | "expire"
  | "adjustment";
export interface CreditTransaction {
  id: string;
  type: CreditTransactionType;
  balanceDelta: number;
  balanceAfter: number;
  referenceType?: string;
  createdAt: string;
}

export interface ReelScript {
  hook: string;
  duration: number;
  scenes: { title: string; narration: string }[];
}

export interface ContentMedia {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  position: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface ContentMetrics {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

export interface AiGenerationRequest {
  userId: string;
  objective: string;
  topic: string;
  format: ContentFormat;
  style: string;
  instructions?: string;
  variations: number;
}

export interface AiContentDraft {
  id: string;
  title: string;
  topic: string;
  format: ContentFormat;
  caption: string;
  hashtags: string[];
  cta: string;
  slides: number;
  creditCost: number;
  slideTexts?: string[];
  reelScript?: ReelScript;
}

/** Consumo de IA por geração, para o painel de custo do admin. */
export interface AiUsageEvent {
  organizationId: string;
  format: ContentFormat;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Milésimos de centavo de dólar: uma imagem custa frações de centavo. */
  costMillicents: number;
  creditsCharged: number;
  apiCalls: number;
  createdAt: string;
}

export interface AdminSnapshot {
  users: User[];
  plans: Plan[];
  creditProducts: CreditProduct[];
  subscriptions: Subscription[];
  contents: Content[];
  queue: QueueItem[];
  prompts: PromptTemplate[];
  audit: AuditEvent[];
  templates: TemplateMeta[];
  aiUsage: AiUsageEvent[];
  /** Teto mensal declarado pelo admin — a OpenAI não expõe saldo por API. */
  aiMonthlyBudgetCents: number;
}

export interface SocialAccount {
  id: string;
  userId: string;
  network: SocialNetwork;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  connected: boolean;
  expiresAt?: string;
  accountType?: string;
  biography?: string;
  followersCount?: number;
  mediaCount?: number;
}

export interface BrandIdentityProposal {
  description: string;
  industry: string;
  specialty: string;
  audience: string;
  personality: string[];
  tone: string[];
  visualStyle: string;
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  evidence: string[];
  confidence: number;
}

export interface Content {
  id: string;
  userId: string;
  title: string;
  format: ContentFormat;
  source: ContentSource;
  status: ContentStatus;
  topic: string;
  caption: string;
  hashtags: string[];
  cta: string;
  altText?: string;
  location?: string;
  link?: string;
  firstComment?: string;
  collaborators?: string[];
  taggedPeople?: string[];
  scheduledAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt?: string;
  templatePath?: string;
  mediaUrls: string[];
  /** Private Storage object references used for persistence and server publishing. */
  mediaStoragePaths?: string[];
  media?: ContentMedia[];
  slideTexts?: string[];
  reelScript?: ReelScript;
  failureReason?: string;
  socialAccountIds?: string[];
  favorite?: boolean;
  folder?: string;
  tags?: string[];
  usageCount?: number;
  metrics?: ContentMetrics;
}

export interface QueueItem {
  id: string;
  contentId: string;
  userId: string;
  scheduledAt: string;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  timezone?: string;
  socialAccountId?: string;
  approvalRequired?: boolean;
  notifyBefore?: boolean;
}

export interface WeeklySlot {
  id: string;
  format: ContentFormat;
  source: ContentSource;
  topic: string;
  date: string;
  time: string;
  quantity?: number;
  slides: number;
  libraryContentId?: string;
  cost: number;
}

export interface WeeklyPlan {
  id: string;
  userId: string;
  weekStart: string;
  status: "draft" | "confirmed";
  slots: WeeklySlot[];
}

export type TemplateLayerType =
  | "container"
  | "text"
  | "image"
  | "svg"
  | "list-container"
  | "gradient"
  | "ellipse"
  | "rectangle"
  | "path"
  | "text-path";

export interface TemplateLayer {
  id: string;
  type: TemplateLayerType | string;
  zIndex?: number;
  styles?: Record<string, unknown>;
  content?: any;
  position?: {
    top?: string;
    left?: string;
    width?: string;
    height?: string;
    type?: string;
  };
  editorMeta?: {
    name?: string;
    locked?: boolean;
    isBackground?: boolean;
    hidden?: boolean;
  };
  fieldName?: string;
  editable?: boolean;
  autoFit?: Record<string, unknown>;
  listConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VisualTemplateV2 {
  schemaVersion?: string;
  templateId: string;
  templateName: string;
  templateType: "post" | "story" | "carousel" | string;
  packageId: string;
  aspectRatio: string;
  dimensions: { width: number; height: number };
  props: Record<string, string>;
  layers: TemplateLayer[];
  carouselSlideType?: "cover" | "content" | "closing";
  contentRequirements?: Record<string, unknown>;
  imageGenerationInstructions?: string;
  textGenerationInstructions?: string;
  [key: string]: unknown;
}

export interface TemplateMeta {
  id: string;
  templateId: string;
  name: string;
  format: "post" | "story" | "carousel";
  packageId: string;
  aspectRatio: string;
  width: number;
  height: number;
  path: string;
  slideType?: string;
  status: "published" | "draft" | "archived";
  version: number;
}

export type PromptTask =
  | "weekly-plan"
  | "visual-copy"
  | "caption"
  | "hashtags"
  | "reel-script";
export interface PromptTemplate {
  id: string;
  name: string;
  task: PromptTask;
  format: ContentFormat | "all";
  version: number;
  status: "active" | "draft" | "archived";
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
  packages: string[];
  outputSchema: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  entity: string;
  at: string;
}

export const formatLabels: Record<ContentFormat, string> = {
  post: "Post",
  carousel: "Carrossel",
  story: "Story",
  reel: "Reels",
  video: "Vídeo",
  caption: "Apenas legenda",
};
// Mesma proporção usada pelo TemplateRenderer para o post final: mantém o
// preview/placeholder consistente com o formato real antes dele existir.
export const formatAspectRatio: Record<ContentFormat, string> = {
  post: "4 / 5",
  carousel: "4 / 5",
  story: "9 / 16",
  reel: "9 / 16",
  video: "9 / 16",
  caption: "1 / 1",
};
export const statusLabels: Record<ContentStatus, string> = {
  draft: "Rascunho",
  generating: "Gerando",
  awaiting_approval: "Aguardando aprovação",
  scheduled: "Agendado",
  processing: "Processando",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falhou",
  paused: "Pausado",
  canceled: "Cancelado",
};
