import type {
  BrandProfile,
  Content,
  CreditBalance,
  Plan,
  QueueItem,
  SocialAccount,
  Subscription,
  User,
} from "../../domain/models";

type Row = Record<string, any>;

export const mapBrand = (row?: Row | null): BrandProfile | undefined =>
  row
    ? {
        id: row.id,
        brandName: row.name ?? "",
        description: row.description ?? "",
        industry: row.industry ?? "",
        specialty: row.specialty ?? "",
        audience: row.audience ?? "",
        goals: row.goals ?? [],
        contentTypes: row.content_formats ?? [],
        personality: row.personality ?? [],
        tone: row.tone ?? [],
        logoUrl: row.logo_path ?? undefined,
        primaryColor: row.primary_color ?? "#7C3AED",
        secondaryColor: row.secondary_color ?? "#A78BFA",
        headingFont: row.heading_font ?? "Inter",
        bodyFont: row.body_font ?? "Inter",
        visualStyle: row.visual_style ?? "",
        instagram: row.instagram_handle ?? "",
        instagramConnected: Boolean(row.instagram_connected),
      }
    : undefined;

export const mapWorkspaceUser = (
  auth: {
    id: string;
    email?: string | null;
    created_at?: string;
    last_sign_in_at?: string | null;
    app_metadata?: { provider?: string; providers?: string[] };
    identities?: { provider?: string }[] | null;
  },
  workspace?: Row | null,
): User => ({
  id: auth.id,
  organizationId: workspace?.organization?.id,
  name:
    workspace?.profile?.display_name ?? auth.email?.split("@")[0] ?? "Usuário",
  email: auth.email ?? "",
  role: workspace?.profile?.system_role === "system_admin" ? "admin" : "user",
  status: workspace?.profile?.status === "suspended" ? "suspended" : "active",
  onboardingCompleted: Boolean(workspace?.profile?.onboarding_completed_at),
  brand: mapBrand(workspace?.brand),
  createdAt:
    workspace?.profile?.created_at ??
    auth.created_at ??
    new Date().toISOString(),
  lastSignInAt: auth.last_sign_in_at ?? undefined,
  authProviders: Array.from(
    new Set(
      [
        ...(auth.app_metadata?.providers ?? []),
        auth.app_metadata?.provider,
        ...(auth.identities ?? []).map((identity) => identity.provider),
      ].filter((provider): provider is string => Boolean(provider)),
    ),
  ),
});

export const mapPlan = (row: Row): Plan => ({
  id: row.id,
  name: row.name,
  price: Number(row.price_cents ?? 0) / 100,
  credits: Number(row.credits ?? 0),
  durationDays: Number(row.duration_days ?? 30),
  available: Boolean(row.available),
  featured: Boolean(row.featured),
  badge: row.badge ?? undefined,
  installments: row.installments_count
    ? {
        count: Number(row.installments_count),
        value: Number(row.installments_value_cents ?? 0) / 100,
      }
    : undefined,
});

export const mapSubscription = (row: Row, credits = 0): Subscription => ({
  id: row.id,
  userId: row.user_id,
  planId: row.plan_id,
  status: row.status === "active" ? "active" : "canceled",
  credits,
  startsAt: row.starts_at,
  expiresAt: row.expires_at,
});

export const mapCredits = (row?: Row | null): CreditBalance | undefined =>
  row
    ? {
        organizationId: row.organization_id,
        balance: Number(row.balance ?? 0),
        reserved: Number(row.reserved ?? 0),
        available: Number(
          row.available ?? Number(row.balance ?? 0) - Number(row.reserved ?? 0),
        ),
        version: Number(row.version ?? 0),
        syncedAt: new Date().toISOString(),
      }
    : undefined;

export const mapContent = (row: Row): Content => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  format: row.format,
  source: row.source,
  status: row.status,
  topic: row.topic ?? "",
  caption: row.caption ?? "",
  hashtags: row.hashtags ?? [],
  cta: row.cta ?? "",
  altText: row.alt_text ?? undefined,
  location: row.location ?? undefined,
  link: row.link ?? undefined,
  firstComment: row.first_comment ?? undefined,
  collaborators: row.collaborators ?? [],
  taggedPeople: row.tagged_people ?? [],
  scheduledAt: row.scheduled_at ?? undefined,
  publishedAt: row.published_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  templatePath: row.template_path ?? undefined,
  mediaUrls: row.media_paths ?? [],
  mediaStoragePaths: row.media_paths ?? [],
  slideTexts: row.slide_texts ?? undefined,
  reelScript: row.reel_script ?? undefined,
  failureReason: row.failure_reason ?? undefined,
  socialAccountIds: row.social_account_ids ?? [],
  favorite: Boolean(row.favorite),
  folder: row.folder ?? undefined,
  tags: row.tags ?? [],
  usageCount: Number(row.usage_count ?? 0),
});

const normalizeQueueStatus = (status: string): QueueItem["status"] => {
  if (status === "queued" || status === "retry_scheduled") return "scheduled";
  if (status === "publishing") return "publishing";
  if (status === "processing") return "processing";
  if (status === "published") return "published";
  if (status === "failed") return "failed";
  if (status === "paused") return "paused";
  if (status === "canceled") return "canceled";
  return "scheduled";
};

export const mapQueue = (row: Row): QueueItem => ({
  id: row.id,
  contentId: row.content_id,
  userId: row.contents?.user_id ?? row.user_id ?? "",
  scheduledAt: row.scheduled_at,
  status: normalizeQueueStatus(row.status),
  attempts: Number(row.attempts ?? 0),
  lastError: row.last_error_message ?? undefined,
  timezone: row.timezone,
  socialAccountId: row.social_account_id ?? undefined,
});

export const mapSocial = (row: Row): SocialAccount => ({
  id: row.id,
  userId: row.user_id,
  network: row.network,
  handle: row.handle,
  displayName: row.display_name,
  avatarUrl: row.avatar_url ?? undefined,
  connected: row.status === "active",
  expiresAt: row.token_expires_at ?? undefined,
  accountType: row.account_type ?? undefined,
  biography: row.biography ?? undefined,
  followersCount:
    row.followers_count == null ? undefined : Number(row.followers_count),
  mediaCount: row.media_count == null ? undefined : Number(row.media_count),
});
