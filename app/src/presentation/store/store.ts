import {
  configureStore,
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { appContainer } from "../../application/container";
import type {
  AiContentDraft,
  AiGenerationRequest,
  AuditEvent,
  BrandProfile,
  Content,
  ContentFormat,
  ContentSource,
  CreditBalance,
  CreditProduct,
  Plan,
  PromptTemplate,
  QueueItem,
  SocialAccount,
  Subscription,
  TemplateMeta,
  ThemeMode,
  User,
  VisualTemplateV2,
  WeeklySlot,
} from "../../domain/models";
import type { CreditPackageId } from "../../domain/creditRules";

export const bootstrapApp = createAsyncThunk("app/bootstrap", () =>
  appContainer.bootstrap(),
);
export const restoreSession = createAsyncThunk("auth/restore", () =>
  appContainer.restoreSession(),
);
export const logoutSession = createAsyncThunk("auth/logoutSession", () =>
  appContainer.logout(),
);
export const refreshCredits = createAsyncThunk("credits/refresh", () =>
  appContainer.getCreditBalance(),
);
export const fetchCreditTransactions = createAsyncThunk(
  "credits/fetchTransactions",
  (days: number) => appContainer.listCreditTransactions(days),
);
export const uploadMedia = createAsyncThunk("media/upload", (files: File[]) =>
  appContainer.uploadMedia(files),
);
export const login = createAsyncThunk(
  "auth/login",
  (input: { email: string; password: string }) =>
    appContainer.login(input.email, input.password),
);
export const loginWithGoogle = createAsyncThunk("auth/loginWithGoogle", () =>
  appContainer.loginWithGoogle(),
);
export const register = createAsyncThunk(
  "auth/register",
  (input: { name: string; email: string; password: string }) =>
    appContainer.register(input),
);
export const completeOnboarding = createAsyncThunk(
  "brand/onboarding",
  (input: { userId: string; brand: BrandProfile }) =>
    appContainer.finishOnboarding(input.userId, input.brand),
);
export const checkout = createAsyncThunk(
  "subscription/checkout",
  (input: { userId: string; planId: Plan["id"] }) =>
    appContainer.subscribe(input.userId, input.planId),
);
export const purchaseCredits = createAsyncThunk(
  "subscription/purchaseCredits",
  (input: { userId: string; packageId: CreditPackageId }) =>
    appContainer.purchaseCredits(input.userId, input.packageId),
);
export const startBillingCheckout = createAsyncThunk(
  "billing/startCheckout",
  (
    input:
      | { userId: string; kind: "plan"; planId: "month" | "year" }
      | { userId: string; kind: "credits"; packageId: CreditPackageId },
  ) => appContainer.startBillingCheckout(input),
);
export const openBillingPortal = createAsyncThunk("billing/openPortal", () =>
  appContainer.openBillingPortal(),
);
export const generateContent = createAsyncThunk(
  "contents/generate",
  (input: {
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
  }) => appContainer.generateContent(input),
);
export const previewAiContent = createAsyncThunk(
  "aiGeneration/preview",
  (input: AiGenerationRequest) => appContainer.previewAiContent(input),
);
export const createContentItem = createAsyncThunk(
  "contents/create",
  (input: {
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
  }) => appContainer.createContent(input),
);
export const updateContentItem = createAsyncThunk(
  "contents/update",
  (input: { id: string; userId: string; patch: Partial<Content> }) =>
    appContainer.updateContentItem(input.id, input.userId, input.patch),
);
export const deleteContentItem = createAsyncThunk(
  "contents/delete",
  (input: { id: string; userId: string }) =>
    appContainer.deleteContentItem(input.id, input.userId),
);
export const scheduleContent = createAsyncThunk(
  "contents/schedule",
  (input: {
    userId: string;
    contentId: string;
    scheduledAt: string;
    options?: {
      timezone?: string;
      socialAccountId?: string;
      approvalRequired?: boolean;
      notifyBefore?: boolean;
      firstComment?: string;
    };
  }) =>
    appContainer.scheduleContent(
      input.userId,
      input.contentId,
      input.scheduledAt,
      input.options,
    ),
);
export const rescheduleQueueItem = createAsyncThunk(
  "queue/reschedule",
  (input: { id: string; userId: string; scheduledAt: string }) =>
    appContainer.rescheduleQueueItem(input.id, input.userId, input.scheduledAt),
);
export const publishQueueItem = createAsyncThunk(
  "queue/publishNow",
  (input: { id: string; userId: string }) =>
    appContainer.publishQueueItem(input.id, input.userId),
);
export const updateSocialAccount = createAsyncThunk(
  "social/update",
  (input: { id: string; patch: Partial<SocialAccount> }) =>
    appContainer.updateSocialAccount(input.id, input.patch),
);
export const connectInstagram = createAsyncThunk(
  "social/connectInstagram",
  (returnPath?: string) => appContainer.connectInstagram(returnPath),
);
export const disconnectInstagram = createAsyncThunk(
  "social/disconnectInstagram",
  async (socialAccountId: string) => {
    await appContainer.disconnectInstagram(socialAccountId);
    return socialAccountId;
  },
);
export const analyzeInstagramBrand = createAsyncThunk(
  "brand/analyzeInstagram",
  (input: { brandId: string; socialAccountId: string }) =>
    appContainer.analyzeInstagramBrand(input),
);
export const confirmWeek = createAsyncThunk(
  "planner/confirm",
  (input: { userId: string; weekStart: string; slots: WeeklySlot[] }) =>
    appContainer.confirmWeek(input.userId, input.weekStart, input.slots),
);
export const createSingleContentPlan = createAsyncThunk(
  "planner/createSingleContent",
  (input: {
    userId: string;
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
  }) => appContainer.createSingleContentPlan(input.userId, input),
);
export const fetchWeeklyPlanProgress = createAsyncThunk(
  "planner/fetchProgress",
  (planId: string) => appContainer.getWeeklyPlanProgress(planId),
);
export const fetchWeeklyPlanSummaries = createAsyncThunk(
  "planner/fetchSummaries",
  (userId: string) => appContainer.listWeeklyPlanSummaries(userId),
);
export const retryWeeklySlot = createAsyncThunk(
  "planner/retrySlot",
  async (input: { slotId: string; planId: string }) => {
    await appContainer.retryWeeklySlot(input.slotId);
    return appContainer.getWeeklyPlanProgress(input.planId);
  },
);
export const generateWeeklyPlan = createAsyncThunk(
  "planner/generateWithAi",
  (input: {
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
  }) => appContainer.suggestWeekWithAi(input),
);
export const advanceQueue = createAsyncThunk(
  "queue/advance",
  (userId?: string) => appContainer.advanceQueue(userId),
);
export const retryQueue = createAsyncThunk("queue/retry", (id: string) =>
  appContainer.retryQueue(id),
);
export const cancelQueue = createAsyncThunk("queue/cancel", (id: string) =>
  appContainer.cancelQueue(id),
);
export const duplicateContent = createAsyncThunk(
  "contents/duplicate",
  (input: { id: string; userId: string }) =>
    appContainer.duplicateContent(input.id, input.userId),
);
export const updateAdminUser = createAsyncThunk(
  "admin/updateUser",
  (input: {
    id: string;
    patch: Partial<User>;
    actor: string;
    creditDelta?: number;
    reason?: string;
  }) =>
    appContainer.updateUser(
      input.id,
      input.patch,
      input.actor,
      input.creditDelta,
      input.reason,
    ),
);
export const updateAdminPlan = createAsyncThunk(
  "admin/updatePlan",
  (input: { id: Plan["id"]; patch: Partial<Plan>; actor: string }) =>
    appContainer.updatePlan(input.id, input.patch, input.actor),
);
export const saveAdminCreditProduct = createAsyncThunk(
  "admin/saveCreditProduct",
  (input: { product: CreditProduct; actor: string }) =>
    appContainer.saveCreditProduct(input.product),
);
export const loadTemplate = createAsyncThunk("templates/load", (id: string) =>
  appContainer.templates.load(id),
);
export const saveTemplate = createAsyncThunk(
  "templates/save",
  (input: { meta: TemplateMeta; spec: VisualTemplateV2; actor: string }) =>
    appContainer.saveTemplate(input.meta, input.spec, input.actor),
);
export const importTemplates = createAsyncThunk(
  "templates/import",
  (input: {
    file: File;
    conflict: "replace" | "rename" | "skip";
    actor: string;
  }) => appContainer.importTemplates(input.file, input.conflict, input.actor),
);
export const exportTemplate = createAsyncThunk(
  "templates/exportOne",
  (id: string) => appContainer.exportTemplate(id),
);
export const exportTemplates = createAsyncThunk(
  "templates/exportAll",
  (format: TemplateMeta["format"]) => appContainer.exportTemplates(format),
);
export const savePrompt = createAsyncThunk(
  "prompts/save",
  (input: { prompt: PromptTemplate; actor: string }) =>
    appContainer.savePrompt(input.prompt, input.actor),
);
export const testAdminPrompt = createAsyncThunk(
  "prompts/test",
  (input: {
    prompt: PromptTemplate;
    sample: { brandName: string; topic: string; audience: string };
  }) => appContainer.testPrompt(input.prompt, input.sample),
);

interface AuthState {
  user: User | null;
  loading: boolean;
  error?: string;
}
const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, loading: false } as AuthState,
  reducers: {
    logout(state) {
      state.user = null;
      state.error = undefined;
    },
    syncUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(register.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(completeOnboarding.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(restoreSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload?.user ?? null;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false;
        state.user = null;
      })
      .addCase(logoutSession.fulfilled, (state) => {
        state.user = null;
        state.error = undefined;
      }),
});

interface BrandState {
  profile?: BrandProfile;
}
const brandSlice = createSlice({
  name: "brand",
  initialState: {} as BrandState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.profile = action.payload.user.brand;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.profile = action.payload?.user.brand;
      })
      .addCase(register.fulfilled, (state) => {
        state.profile = undefined;
      })
      .addCase(completeOnboarding.fulfilled, (state, action) => {
        state.profile = action.payload.brand;
      })
      .addCase(logoutSession.fulfilled, (state) => {
        state.profile = undefined;
      }),
});

interface SubscriptionState {
  plans: Plan[];
  creditProducts: CreditProduct[];
  current?: Subscription;
  all: Subscription[];
}
const subscriptionSlice = createSlice({
  name: "subscription",
  initialState: { plans: [], creditProducts: [], all: [] } as SubscriptionState,
  reducers: {
    syncCredits(state, action: PayloadAction<number>) {
      if (state.current) state.current.credits = action.payload;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(bootstrapApp.fulfilled, (state, action) => {
        state.plans = action.payload.plans;
        state.all = action.payload.subscriptions;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.current = action.payload.subscription;
        const adminPayload = action.payload as typeof action.payload & {
          plans?: Plan[];
          creditProducts?: CreditProduct[];
          subscriptions?: Subscription[];
        };
        if (adminPayload.plans) state.plans = adminPayload.plans;
        if (adminPayload.creditProducts) state.creditProducts = adminPayload.creditProducts;
        if (adminPayload.subscriptions)
          state.all = adminPayload.subscriptions;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.current = action.payload?.subscription;
        const adminPayload = action.payload as
          | (NonNullable<typeof action.payload> & {
              plans?: Plan[];
              creditProducts?: CreditProduct[];
              subscriptions?: Subscription[];
            })
          | undefined;
        if (adminPayload?.plans) state.plans = adminPayload.plans;
        if (adminPayload?.creditProducts) state.creditProducts = adminPayload.creditProducts;
        if (adminPayload?.subscriptions)
          state.all = adminPayload.subscriptions;
      })
      .addCase(register.fulfilled, (state) => {
        state.current = undefined;
      })
      .addCase(checkout.fulfilled, (state, action) => {
        state.current = action.payload;
        state.all = [
          ...state.all.filter((item) => item.userId !== action.payload.userId),
          action.payload,
        ];
      })
      .addCase(purchaseCredits.fulfilled, (state, action) => {
        state.current = action.payload;
        state.all = state.all.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
      })
      .addCase(generateContent.fulfilled, (state, action) => {
        if (action.payload.subscription)
          state.current = action.payload.subscription;
      })
      .addCase(scheduleContent.fulfilled, (state, action) => {
        if (action.payload.subscription)
          state.current = action.payload.subscription;
      })
      .addCase(updateAdminPlan.fulfilled, (state, action) => {
        state.plans = state.plans.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
      })
      .addCase(saveAdminCreditProduct.fulfilled, (state, action) => {
        const index = state.creditProducts.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state.creditProducts[index] = action.payload;
        else state.creditProducts.push(action.payload);
      })
      .addCase(logoutSession.fulfilled, (state) => {
        state.current = undefined;
      }),
});

interface CreditsState {
  current?: CreditBalance;
  loading: boolean;
  error?: string;
}
const creditsSlice = createSlice({
  name: "credits",
  initialState: { loading: false } as CreditsState,
  reducers: {
    sync(state, action: PayloadAction<CreditBalance>) {
      if (!state.current || action.payload.version >= state.current.version)
        state.current = action.payload;
    },
    clear(state) {
      state.current = undefined;
      state.error = undefined;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(refreshCredits.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(refreshCredits.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) state.current = action.payload;
      })
      .addCase(refreshCredits.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.current = action.payload.creditBalance;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.current = action.payload?.creditBalance;
      })
      .addCase(scheduleContent.fulfilled, (state, action) => {
        if (action.payload.creditBalance)
          state.current = action.payload.creditBalance;
      })
      .addCase(generateContent.fulfilled, (state, action) => {
        if (action.payload.creditBalance)
          state.current = action.payload.creditBalance;
      })
      .addCase(logoutSession.fulfilled, (state) => {
        state.current = undefined;
        state.error = undefined;
      }),
});

interface ContentsState {
  items: Content[];
  queue: QueueItem[];
  generating: boolean;
}
const contentsSlice = createSlice({
  name: "contents",
  initialState: { items: [], queue: [], generating: false } as ContentsState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(bootstrapApp.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.items = action.payload?.contents ?? [];
        state.queue = action.payload?.queue ?? [];
      })
      .addCase(generateContent.pending, (state) => {
        state.generating = true;
      })
      .addCase(generateContent.fulfilled, (state, action) => {
        state.generating = false;
        state.items.unshift(action.payload.content);
      })
      .addCase(generateContent.rejected, (state) => {
        state.generating = false;
      })
      .addCase(createContentItem.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateContentItem.fulfilled, (state, action) => {
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
      })
      .addCase(deleteContentItem.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(scheduleContent.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(rescheduleQueueItem.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(publishQueueItem.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(advanceQueue.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(retryQueue.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(cancelQueue.fulfilled, (state, action) => {
        state.items = action.payload.contents;
        state.queue = action.payload.queue;
      })
      .addCase(duplicateContent.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(logoutSession.fulfilled, (state) => {
        state.items = [];
        state.queue = [];
      }),
});

interface AiGenerationState {
  drafts: AiContentDraft[];
  generating: boolean;
  error?: string;
}
const aiGenerationSlice = createSlice({
  name: "aiGeneration",
  initialState: { drafts: [], generating: false } as AiGenerationState,
  reducers: {
    clearDrafts(state) {
      state.drafts = [];
      state.error = undefined;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(previewAiContent.pending, (state) => {
        state.generating = true;
        state.error = undefined;
      })
      .addCase(previewAiContent.fulfilled, (state, action) => {
        state.generating = false;
        state.drafts = action.payload;
      })
      .addCase(previewAiContent.rejected, (state, action) => {
        state.generating = false;
        state.error = action.error.message;
      }),
});

interface SocialState {
  items: SocialAccount[];
}
const socialSlice = createSlice({
  name: "socialAccounts",
  initialState: { items: [] } as SocialState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.items = action.payload.socialAccounts ?? [];
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.items = action.payload?.socialAccounts ?? [];
      })
      .addCase(updateSocialAccount.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id,
        );
        if (index >= 0) state.items[index] = action.payload;
        else state.items.push(action.payload);
      })
      .addCase(disconnectInstagram.fulfilled, (state, action) => {
        const account = state.items.find((item) => item.id === action.payload);
        if (account) {
          account.connected = false;
          account.expiresAt = undefined;
        }
      })
      .addCase(logoutSession.fulfilled, (state) => {
        state.items = [];
      }),
});

interface PlannerState {
  weekStart: string;
  slots: WeeklySlot[];
  confirming: boolean;
  generating: boolean;
}
const plannerSlotCost = (slot: WeeklySlot) =>
  slot.source === "ai"
    ? 5 * (slot.format === "carousel" ? slot.slides : 1) * (slot.quantity ?? 1)
    : 2 * (slot.quantity ?? 1);
const normalizePlannerSlot = (slot: WeeklySlot): WeeklySlot => {
  const quantity = Math.min(5, Math.max(1, slot.quantity ?? 1));
  const next = { ...slot, quantity };
  return { ...next, cost: plannerSlotCost(next) };
};
const plannerSlice = createSlice({
  name: "planner",
  initialState: {
    weekStart: "",
    slots: [],
    confirming: false,
    generating: false,
  } as PlannerState,
  reducers: {
    setWeekStart(state, action: PayloadAction<string>) {
      state.weekStart = action.payload;
    },
    setSlots(state, action: PayloadAction<WeeklySlot[]>) {
      state.slots = action.payload.slice(0, 7).map(normalizePlannerSlot);
    },
    updateSlot(
      state,
      action: PayloadAction<{ id: string; patch: Partial<WeeklySlot> }>,
    ) {
      const slot = state.slots.find((item) => item.id === action.payload.id);
      if (slot)
        Object.assign(
          slot,
          normalizePlannerSlot({ ...slot, ...action.payload.patch }),
        );
    },
    removeSlot(state, action: PayloadAction<string>) {
      state.slots = state.slots.filter((item) => item.id !== action.payload);
    },
    addSlot(state, action: PayloadAction<WeeklySlot>) {
      if (
        state.slots.length < 7 &&
        !state.slots.some((slot) => slot.date === action.payload.date)
      )
        state.slots.push(normalizePlannerSlot(action.payload));
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(generateWeeklyPlan.pending, (state) => {
        state.generating = true;
      })
      .addCase(generateWeeklyPlan.fulfilled, (state, action) => {
        state.generating = false;
        state.slots = action.payload.map(normalizePlannerSlot);
      })
      .addCase(generateWeeklyPlan.rejected, (state) => {
        state.generating = false;
      })
      .addCase(confirmWeek.pending, (state) => {
        state.confirming = true;
      })
      .addCase(confirmWeek.fulfilled, (state) => {
        state.confirming = false;
        state.slots = [];
      })
      .addCase(confirmWeek.rejected, (state) => {
        state.confirming = false;
      }),
});

interface TemplatesState {
  catalog: TemplateMeta[];
  selected?: VisualTemplateV2;
  selectedId?: string;
  loading: boolean;
}
const templatesSlice = createSlice({
  name: "adminTemplates",
  initialState: { catalog: [], loading: false } as TemplatesState,
  reducers: {
    clearSelected(state) {
      state.selected = undefined;
      state.selectedId = undefined;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(bootstrapApp.fulfilled, (state, action) => {
        state.catalog = action.payload.templates;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.catalog = action.payload.templates ?? [];
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.catalog = action.payload?.templates ?? [];
      })
      .addCase(loadTemplate.pending, (state, action) => {
        state.loading = true;
        state.selectedId = action.meta.arg;
      })
      .addCase(loadTemplate.fulfilled, (state, action) => {
        state.loading = false;
        state.selected = action.payload;
      })
      .addCase(loadTemplate.rejected, (state) => {
        state.loading = false;
      })
      .addCase(saveTemplate.fulfilled, (state, action) => {
        const index = state.catalog.findIndex(
          (item) => item.id === action.payload.id,
        );
        if (index >= 0) state.catalog[index] = action.payload;
        else state.catalog.unshift(action.payload);
      })
      .addCase(importTemplates.fulfilled, (state, action) => {
        const ids = new Set(action.payload.map((item) => item.id));
        state.catalog = [
          ...action.payload,
          ...state.catalog.filter((item) => !ids.has(item.id)),
        ];
      }),
});

interface PromptsState {
  items: PromptTemplate[];
}
const promptsSlice = createSlice({
  name: "adminPrompts",
  initialState: { items: [] } as PromptsState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(bootstrapApp.fulfilled, (state, action) => {
        state.items = action.payload.prompts;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.items = action.payload.prompts ?? [];
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.items = action.payload?.prompts ?? [];
      })
      .addCase(savePrompt.fulfilled, (state, action) => {
        if (action.payload.status === "active")
          state.items = state.items.map((item) =>
            item.task === action.payload.task &&
            item.format === action.payload.format
              ? {
                  ...item,
                  status: item.id === action.payload.id ? "active" : "archived",
                }
              : item,
          );
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id,
        );
        if (index >= 0) state.items[index] = action.payload;
        else state.items.unshift(action.payload);
      }),
});

interface AdminState {
  users: User[];
  audit: AuditEvent[];
}
const adminSlice = createSlice({
  name: "admin",
  initialState: { users: [], audit: [] } as AdminState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(bootstrapApp.fulfilled, (state, action) => {
        state.users = action.payload.users;
        state.audit = action.payload.audit;
      })
      .addCase(login.fulfilled, (state, action) => {
        const adminPayload = action.payload as typeof action.payload & {
          users?: User[];
          audit?: AuditEvent[];
        };
        state.users = adminPayload.users ?? [];
        state.audit = adminPayload.audit ?? [];
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        const adminPayload = action.payload as
          | (NonNullable<typeof action.payload> & {
              users?: User[];
              audit?: AuditEvent[];
            })
          | undefined;
        state.users = adminPayload?.users ?? [];
        state.audit = adminPayload?.audit ?? [];
      })
      .addCase(updateAdminUser.fulfilled, (state, action) => {
        state.users = state.users.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
      }),
});

interface UiState {
  theme: ThemeMode;
  notice?: { tone: "success" | "error" | "info"; message: string };
  bootstrapped: boolean;
}
const initialTheme: ThemeMode =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
const uiSlice = createSlice({
  name: "ui",
  initialState: { theme: initialTheme, bootstrapped: false } as UiState,
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === "dark" ? "light" : "dark";
    },
    setNotice(state, action: PayloadAction<UiState["notice"]>) {
      state.notice = action.payload;
    },
    clearNotice(state) {
      state.notice = undefined;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(restoreSession.fulfilled, (state) => {
        state.bootstrapped = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.bootstrapped = true;
      }),
});

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    brand: brandSlice.reducer,
    subscription: subscriptionSlice.reducer,
    credits: creditsSlice.reducer,
    contents: contentsSlice.reducer,
    planner: plannerSlice.reducer,
    aiGeneration: aiGenerationSlice.reducer,
    socialAccounts: socialSlice.reducer,
    adminTemplates: templatesSlice.reducer,
    adminPrompts: promptsSlice.reducer,
    admin: adminSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "templates/import/pending",
          "templates/exportOne/fulfilled",
          "templates/exportAll/fulfilled",
        ],
        ignoredActionPaths: ["meta.arg", "payload.blob"],
      },
    }),
});
export const authActions = authSlice.actions;
export const subscriptionActions = subscriptionSlice.actions;
export const creditsActions = creditsSlice.actions;
export const plannerActions = plannerSlice.actions;
export const aiGenerationActions = aiGenerationSlice.actions;
export const templateActions = templatesSlice.actions;
export const uiActions = uiSlice.actions;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
