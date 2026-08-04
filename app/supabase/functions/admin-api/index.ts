import { z } from "npm:zod@3.24.2";
import { authenticate, requirePost } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/config.ts";
import {
  errorResponse,
  HttpError,
  json,
  preflight,
  traceIdFor,
} from "../_shared/http.ts";
import {
  generateContentDraftsWithOpenAI,
  generateWeeklyPlanWithOpenAI,
} from "../_shared/openai.ts";
import { getStripe } from "../_shared/stripe.ts";

const roleSchema = z.enum(["user", "system_admin"]);
const statusSchema = z.enum(["active", "suspended"]);
const promptSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3).max(160),
  task: z.enum(["weekly-plan", "visual-copy", "caption", "hashtags", "reel-script"]),
  format: z.string().trim().min(2).max(40),
  version: z.number().int().min(1).max(10000),
  status: z.enum(["active", "draft", "archived"]),
  systemPrompt: z.string().min(10).max(20000),
  userPrompt: z.string().min(5).max(20000),
  variables: z.array(z.string().trim().min(1).max(80)).max(100),
  packages: z.array(z.string().trim().min(1).max(160)).max(1000),
  outputSchema: z.union([z.string().max(50000), z.record(z.unknown())]),
}).strict();

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("snapshot") }).strict(),
  z.object({
    action: z.literal("save-credit-product"),
    product: z.object({
      id: z.string().regex(/^credits_[0-9]+$/).optional(),
      name: z.string().trim().min(2).max(80),
      credits: z.number().int().min(1).max(100000),
      priceCents: z.number().int().min(50).max(100000000),
      available: z.boolean(),
      featured: z.boolean(),
      position: z.number().int().min(0).max(10000),
    }).strict(),
    idempotencyKey: z.string().trim().min(16).max(200),
  }).strict(),
  z.object({
    action: z.literal("update-user"),
    userId: z.string().uuid(),
    displayName: z.string().trim().min(1).max(120),
    systemRole: roleSchema,
    status: statusSchema,
    creditDelta: z.number().int().min(-100000).max(100000).default(0),
    reason: z.string().trim().min(3).max(500).default("Ajuste administrativo"),
    idempotencyKey: z.string().trim().min(16).max(200),
  }).strict(),
  z.object({
    action: z.literal("update-plan"),
    planId: z.enum(["week", "month", "year"]),
    patch: z.object({
      name: z.string().trim().min(2).max(120),
      priceCents: z.number().int().min(0).max(100000000),
      credits: z.number().int().min(0).max(1000000),
      durationDays: z.number().int().min(1).max(5000),
      available: z.boolean(),
      featured: z.boolean(),
      badge: z.string().trim().max(120).nullable().optional(),
    }).strict(),
    idempotencyKey: z.string().trim().min(16).max(200),
  }).strict(),
  z.object({ action: z.literal("queue-retry"), jobId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("queue-cancel"), jobId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("save-prompt"), prompt: promptSchema }).strict(),
  z.object({
    action: z.literal("test-prompt"),
    prompt: promptSchema,
    sample: z.object({
      brandName: z.string().trim().min(2).max(120),
      topic: z.string().trim().min(3).max(500),
      audience: z.string().trim().min(3).max(500),
    }).strict(),
  }).strict(),
  z.object({ action: z.literal("archive-prompt"), promptId: z.string().uuid() }).strict(),
  z.object({
    action: z.literal("save-ai-budget"),
    // Teto de US$ 100.000/mês é folgado o bastante para qualquer uso real e
    // barra um zero digitado a mais por engano.
    monthlyBudgetCents: z.number().int().min(0).max(10_000_000),
  }).strict(),
]);

const assertSystemAdmin = async (userId: string) => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,system_role,status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.system_role !== "system_admin" || data.status !== "active")
    throw new HttpError(403, "ADMIN_REQUIRED", "Acesso restrito ao administrador.");
};

const snapshot = async () => {
  const admin = createAdminClient();
  const [
    authUsers,
    profiles,
    memberships,
    organizations,
    brands,
    subscriptions,
    wallets,
    plans,
    creditProducts,
    contents,
    jobs,
    prompts,
    audit,
    templates,
    aiUsage,
    aiCostSettings,
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("organization_members").select("*"),
    admin.from("organizations").select("*"),
    admin.from("brands").select("*"),
    admin.from("subscriptions").select("*").order("created_at", { ascending: false }),
    admin.from("credit_wallets").select("*"),
    admin.from("plans").select("*").order("price_cents"),
    admin.from("credit_products").select("*").order("position").order("credits"),
    admin.from("contents").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(1000),
    admin.from("publishing_jobs").select("*,contents!inner(user_id)").order("scheduled_at", { ascending: false }).limit(1000),
    admin.from("prompt_templates").select("*").order("updated_at", { ascending: false }),
    admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("visual_templates").select("*").order("updated_at", { ascending: false }),
    // 90 dias cobre a visão de mês do painel com folga, sem trazer histórico
    // inteiro de custo para dentro de um snapshot já grande.
    admin.from("ai_usage_events")
      .select("organization_id,format,total_tokens,input_tokens,output_tokens,cost_millicents,credits_charged,api_calls,created_at")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
    admin.from("ai_cost_settings").select("monthly_budget_cents").eq("id", true).maybeSingle(),
  ]);
  const firstError = [profiles, memberships, organizations, brands, subscriptions, wallets, plans, creditProducts, contents, jobs, prompts, audit, templates, aiUsage, aiCostSettings]
    .find((result) => result.error)?.error ?? authUsers.error;
  if (firstError) throw firstError;
  return {
    authUsers: authUsers.data.users.map((user) => ({
      id: user.id,
      email: user.email ?? "",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      providers: user.app_metadata?.providers ?? [],
    })),
    profiles: profiles.data ?? [],
    memberships: memberships.data ?? [],
    organizations: organizations.data ?? [],
    brands: brands.data ?? [],
    subscriptions: subscriptions.data ?? [],
    wallets: wallets.data ?? [],
    plans: plans.data ?? [],
    creditProducts: creditProducts.data ?? [],
    contents: contents.data ?? [],
    jobs: jobs.data ?? [],
    prompts: prompts.data ?? [],
    audit: audit.data ?? [],
    templates: templates.data ?? [],
    aiUsage: aiUsage.data ?? [],
    aiMonthlyBudgetCents: aiCostSettings.data?.monthly_budget_cents ?? 0,
  };
};

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { user } = await authenticate(request);
    await assertSystemAdmin(user.id);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_ADMIN_INPUT", "Revise os dados administrativos.");
    const input = parsed.data;
    const admin = createAdminClient();

    if (input.action === "snapshot")
      return json(request, { snapshot: await snapshot(), traceId });

    if (input.action === "test-prompt") {
      const promptTemplate = {
        systemPrompt: input.prompt.systemPrompt,
        userPrompt: input.prompt.userPrompt,
      };
      if (input.prompt.task === "weekly-plan") {
        const generated = await generateWeeklyPlanWithOpenAI({
          userId: user.id,
          weekStart: new Date().toISOString().slice(0, 10),
          selectedDays: [0, 2, 4],
          formats: ["post", "carousel", "story"],
          quantity: 1,
          objective: input.sample.topic,
          preferences: {
            avoidRepeated: true,
            varyTopics: true,
            includeDates: false,
            useProducts: false,
            usePrevious: false,
          },
          brand: {
            name: input.sample.brandName,
            audience: input.sample.audience,
          },
          promptTemplate,
        });
        return json(request, { result: generated.plan, model: generated.model, traceId });
      }
      const format = input.prompt.format === "all"
        ? "post"
        : input.prompt.format;
      const generated = await generateContentDraftsWithOpenAI({
        userId: user.id,
        objective: input.prompt.task,
        topic: input.sample.topic,
        format,
        style: "Identidade da marca",
        variations: 1,
        slides: format === "carousel" ? 5 : 1,
        brand: {
          name: input.sample.brandName,
          audience: input.sample.audience,
        },
        promptTemplate,
      });
      return json(request, {
        result: generated.drafts[0],
        model: generated.model,
        traceId,
      });
    }

    if (input.action === "update-user") {
      if (input.userId === user.id &&
        (input.systemRole !== "system_admin" || input.status !== "active"))
        throw new HttpError(422, "SELF_LOCKOUT", "Você não pode remover o próprio acesso administrativo.");
      const { data: before, error: beforeError } = await admin
        .from("profiles")
        .select("*")
        .eq("id", input.userId)
        .single();
      if (beforeError) throw beforeError;
      if (before.system_role === "system_admin" &&
        (input.systemRole !== "system_admin" || input.status !== "active")) {
        const { count, error: countError } = await admin
          .from("profiles")
          .select("id", { head: true, count: "exact" })
          .eq("system_role", "system_admin")
          .eq("status", "active");
        if (countError) throw countError;
        if ((count ?? 0) <= 1)
          throw new HttpError(422, "LAST_ADMIN", "Mantenha pelo menos um administrador ativo.");
      }
      const { data: updated, error: updateError } = await admin
        .from("profiles")
        .update({
          display_name: input.displayName,
          system_role: input.systemRole,
          status: input.status,
        })
        .eq("id", input.userId)
        .select()
        .single();
      if (updateError) throw updateError;
      const { data: membership, error: membershipError } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", input.userId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (input.creditDelta && membership?.organization_id) {
        const rpc = input.creditDelta > 0 ? "grant_credits_service" : "consume_credits_service";
        const amountKey = input.creditDelta > 0 ? "amount_to_grant" : "amount_to_consume";
        const { error: creditError } = await admin.rpc(rpc, {
          target_org: membership.organization_id,
          [amountKey]: Math.abs(input.creditDelta),
          idem_key: `admin-credit:${input.idempotencyKey}`.slice(0, 200),
          ref_type: "admin_adjustment",
          ref_id: input.userId,
          actor_id: user.id,
        });
        if (creditError) throw creditError;
      }
      await admin.from("audit_logs").insert({
        organization_id: membership?.organization_id ?? null,
        actor_user_id: user.id,
        action: "admin_user_updated",
        entity_type: "profile",
        entity_id: input.userId,
        before_data: before,
        after_data: { ...updated, credit_delta: input.creditDelta },
        reason: input.reason,
      });
      return json(request, { snapshot: await snapshot(), traceId });
    }

    if (input.action === "update-plan") {
      const { data: before, error: beforeError } = await admin
        .from("plans").select("*").eq("id", input.planId).single();
      if (beforeError) throw beforeError;
      const stripe = getStripe();
      const product = before.stripe_product_id
        ? await stripe.products.update(before.stripe_product_id, {
            name: input.patch.name,
            active: input.patch.available,
            metadata: { lumipost_catalog: "plan", lumipost_plan_id: input.planId },
          })
        : await stripe.products.create({
            name: input.patch.name,
            active: input.patch.available,
            metadata: { lumipost_catalog: "plan", lumipost_plan_id: input.planId },
            idempotencyKey: `lumipost-plan-product:${input.planId}`,
          });
      const recurring = input.planId === "year"
        ? { interval: "year" as const }
        : { interval: "month" as const };
      const price = before.stripe_price_id && before.price_cents === input.patch.priceCents
        ? { id: before.stripe_price_id }
        : await stripe.prices.create({
          product: product.id,
          currency: "brl",
          unit_amount: input.patch.priceCents,
          recurring,
          metadata: { lumipost_catalog: "plan", lumipost_plan_id: input.planId },
        }, { idempotencyKey: `lumipost-plan-price:${input.planId}:${input.idempotencyKey}` });
      if (before.stripe_price_id && before.stripe_price_id !== price.id)
        await stripe.prices.update(before.stripe_price_id, { active: false });
      const { error: updateError } = await admin.from("plans").update({
        name: input.patch.name,
        price_cents: input.patch.priceCents,
        credits: input.patch.credits,
        duration_days: input.patch.durationDays,
        available: input.patch.available,
        featured: input.patch.featured,
        badge: input.patch.badge ?? null,
        version: before.version + 1,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      }).eq("id", input.planId);
      if (updateError) throw updateError;
      await admin.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "admin_plan_updated",
        entity_type: "plan",
        entity_id: input.planId,
        before_data: before,
        after_data: input.patch,
      });
      return json(request, { snapshot: await snapshot(), traceId });
    }

    if (input.action === "save-credit-product") {
      const productInput = input.product;
      const { data: before, error: beforeError } = productInput.id
        ? await admin.from("credit_products").select("*").eq("id", productInput.id).maybeSingle()
        : { data: null, error: null };
      if (beforeError) throw beforeError;
      if (productInput.id && !before)
        throw new HttpError(404, "PRODUCT_NOT_FOUND", "Pacote de crÃ©ditos nÃ£o encontrado.");
      const id = productInput.id ?? `credits_${productInput.credits}`;
      if (!productInput.id) {
        const { data: collision, error: collisionError } = await admin
          .from("credit_products").select("id").eq("id", id).maybeSingle();
        if (collisionError) throw collisionError;
        if (collision)
          throw new HttpError(409, "CREDIT_PRODUCT_EXISTS", "JÃ¡ existe um pacote com essa quantidade de crÃ©ditos.");
      }
      const stripe = getStripe();
      const stripeProduct = before?.stripe_product_id
        ? await stripe.products.update(before.stripe_product_id, {
            name: productInput.name,
            active: productInput.available,
            metadata: { lumipost_catalog: "credit_pack", lumipost_credit_product_id: id },
          })
        : await stripe.products.create({
            name: productInput.name,
            active: productInput.available,
            metadata: { lumipost_catalog: "credit_pack", lumipost_credit_product_id: id },
            idempotencyKey: `lumipost-credit-product:${id}`,
          });
      const stripePrice = before?.stripe_price_id && before.price_cents === productInput.priceCents
        ? { id: before.stripe_price_id }
        : await stripe.prices.create({
          product: stripeProduct.id,
          currency: "brl",
          unit_amount: productInput.priceCents,
          metadata: { lumipost_catalog: "credit_pack", lumipost_credit_product_id: id },
        }, { idempotencyKey: `lumipost-credit-price:${id}:${input.idempotencyKey}` });
      if (before?.stripe_price_id && before.stripe_price_id !== stripePrice.id)
        await stripe.prices.update(before.stripe_price_id, { active: false });
      const payload = {
        id,
        name: productInput.name,
        credits: productInput.credits,
        price_cents: productInput.priceCents,
        available: productInput.available,
        featured: productInput.featured,
        position: productInput.position,
        stripe_product_id: stripeProduct.id,
        stripe_price_id: stripePrice.id,
      };
      const result = await admin.from("credit_products").upsert(payload).select().single();
      if (result.error) throw result.error;
      await admin.from("audit_logs").insert({
        actor_user_id: user.id,
        action: before ? "admin_credit_product_updated" : "admin_credit_product_created",
        entity_type: "credit_product",
        entity_id: id,
        before_data: before,
        after_data: { ...payload, stripe_price_id: stripePrice.id },
      });
      return json(request, { snapshot: await snapshot(), traceId });
    }

    if (input.action === "queue-retry" || input.action === "queue-cancel") {
      const { data: job, error: jobError } = await admin
        .from("publishing_jobs")
        .select("*")
        .eq("id", input.jobId)
        .single();
      if (jobError) throw jobError;
      const retry = input.action === "queue-retry";
      if (retry && !["failed", "canceled", "paused"].includes(job.status))
        throw new HttpError(409, "INVALID_JOB_STATE", "Este item não pode ser reprocessado.");
      if (!retry && ["published", "publishing"].includes(job.status))
        throw new HttpError(409, "INVALID_JOB_STATE", "Este item não pode ser cancelado.");
      const status = retry ? "scheduled" : "canceled";
      const { error: updateError } = await admin.from("publishing_jobs").update({
        status,
        scheduled_at: retry ? new Date().toISOString() : job.scheduled_at,
        next_attempt_at: null,
        last_error_code: null,
        last_error_message: null,
      }).eq("id", input.jobId);
      if (updateError) throw updateError;
      await admin.from("contents").update({
        status,
        failure_reason: null,
        scheduled_at: retry ? new Date().toISOString() : undefined,
      }).eq("id", job.content_id);
      await admin.from("audit_logs").insert({
        organization_id: job.organization_id,
        actor_user_id: user.id,
        action: retry ? "admin_job_retried" : "admin_job_canceled",
        entity_type: "publishing_job",
        entity_id: job.id,
        before_data: job,
        after_data: { status },
      });
      return json(request, { snapshot: await snapshot(), traceId });
    }

    if (input.action === "save-ai-budget") {
      const { error: budgetError } = await admin
        .from("ai_cost_settings")
        .update({
          monthly_budget_cents: input.monthlyBudgetCents,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);
      if (budgetError) throw budgetError;
      await admin.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "ai_budget_updated",
        entity_type: "ai_cost_settings",
        entity_id: null,
        after_data: { monthly_budget_cents: input.monthlyBudgetCents },
      });
      return json(request, { snapshot: await snapshot(), traceId });
    }

    if (input.action === "save-prompt") {
      const prompt = input.prompt;
      if (prompt.status === "active") {
        const { error: archiveError } = await admin.from("prompt_templates")
          .update({ status: "archived" })
          .eq("task", prompt.task)
          .eq("format", prompt.format)
          .eq("status", "active")
          .neq("id", prompt.id ?? "00000000-0000-0000-0000-000000000000");
        if (archiveError) throw archiveError;
      }
      let outputSchema: Record<string, unknown>;
      try {
        outputSchema = typeof prompt.outputSchema === "string"
          ? JSON.parse(prompt.outputSchema)
          : prompt.outputSchema;
      } catch {
        throw new HttpError(422, "INVALID_OUTPUT_SCHEMA", "O schema de saída não é um JSON válido.");
      }
      const payload = {
        name: prompt.name,
        task: prompt.task,
        format: prompt.format,
        version: prompt.version,
        status: prompt.status,
        system_prompt: prompt.systemPrompt,
        user_prompt: prompt.userPrompt,
        variables: prompt.variables,
        packages: prompt.packages,
        output_schema: outputSchema,
      };
      const upsertPayload = prompt.id ? { id: prompt.id, ...payload } : payload;
      const result = await admin.from("prompt_templates")
        .upsert(upsertPayload as never)
        .select()
        .single();
      if (result.error) throw result.error;
      await admin.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "admin_prompt_saved",
        entity_type: "prompt_template",
        entity_id: result.data.id,
        after_data: { task: prompt.task, format: prompt.format, version: prompt.version, status: prompt.status },
      });
      return json(request, { snapshot: await snapshot(), traceId });
    }

    const { error: archiveError } = await admin.from("prompt_templates")
      .update({ status: "archived" })
      .eq("id", input.promptId);
    if (archiveError) throw archiveError;
    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "admin_prompt_archived",
      entity_type: "prompt_template",
      entity_id: input.promptId,
    });
    return json(request, { snapshot: await snapshot(), traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
