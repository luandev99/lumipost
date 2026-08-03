import { z } from "npm:zod@3.24.2";
import { authenticate, requirePost } from "../_shared/auth.ts";
import { appUrl, createAdminClient } from "../_shared/config.ts";
import {
  errorResponse,
  HttpError,
  json,
  preflight,
  traceIdFor,
} from "../_shared/http.ts";
import { getStripe, stripeLiveMode } from "../_shared/stripe.ts";

const inputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("subscription"),
      planId: z.enum(["month", "year"]),
      idempotencyKey: z
        .string()
        .min(12)
        .max(120)
        .regex(/^[A-Za-z0-9:_-]+$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("credit_pack"),
      creditProductId: z.string().regex(/^credits_[0-9]+$/),
      idempotencyKey: z
        .string()
        .min(12)
        .max(120)
        .regex(/^[A-Za-z0-9:_-]+$/),
    })
    .strict(),
]);

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);

  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_INPUT", "Escolha um produto válido.");
    const input = parsed.data;

    const { data: membership, error: membershipError } = await client
      .from("organization_members")
      .select("organization_id,role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership)
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Somente responsáveis pela conta podem comprar.",
      );

    const organizationId = membership.organization_id as string;
    const admin = createAdminClient();
    if (input.kind === "subscription") {
      const { data: existingSubscription, error: subscriptionError } =
        await admin
          .from("subscriptions")
          .select("id,status")
          .eq("organization_id", organizationId)
          .in("status", ["active", "past_due"])
          .limit(1)
          .maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (existingSubscription)
        throw new HttpError(
          409,
          "SUBSCRIPTION_ALREADY_EXISTS",
          "Gerencie a assinatura atual pelo portal de cobranÃ§a.",
        );
    }
    const catalogResult =
      input.kind === "subscription"
        ? await admin
            .from("plans")
            .select("id,name,available,stripe_price_secret_name,stripe_price_id")
            .eq("id", input.planId)
            .single()
        : await admin
            .from("credit_products")
            .select("id,name,available,stripe_price_secret_name,stripe_price_id")
            .eq("id", input.creditProductId)
            .single();
    if (catalogResult.error || !catalogResult.data?.available) {
      throw new HttpError(
        404,
        "PRODUCT_NOT_FOUND",
        "Este produto não está disponível.",
      );
    }

    const secretName = catalogResult.data.stripe_price_secret_name as
      | string
      | null;
    const priceId = (catalogResult.data.stripe_price_id as string | null) ??
      (secretName ? Deno.env.get(secretName) : undefined);
    if (!priceId || !priceId.startsWith("price_"))
      throw new Error("MISSING_SERVER_CONFIG:STRIPE_PRICE");

    const stripe = getStripe();
    const { data: storedCustomer, error: customerReadError } = await admin
      .from("billing_customers")
      .select("stripe_customer_id,stripe_livemode")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (customerReadError) throw customerReadError;

    const liveMode = stripeLiveMode();
    let customerId = storedCustomer?.stripe_livemode === liveMode
      ? storedCustomer.stripe_customer_id as string | undefined
      : undefined;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name:
            typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : undefined,
          metadata: {
            organization_id: organizationId,
            supabase_user_id: user.id,
          },
        },
        { idempotencyKey: `customer:${organizationId}` },
      );
      customerId = customer.id;
      const { error } = await admin.from("billing_customers").upsert(
        {
          organization_id: organizationId,
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_livemode: liveMode,
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
    }

    const metadata = {
      organization_id: organizationId,
      supabase_user_id: user.id,
      purchase_kind: input.kind,
      catalog_id:
        input.kind === "subscription" ? input.planId : input.creditProductId,
    };
    const baseUrl = appUrl();
    const returnPath = input.kind === "subscription" ? "/assinar" : "/credits";
    const session = await stripe.checkout.sessions.create(
      {
        mode: input.kind === "subscription" ? "subscription" : "payment",
        customer: customerId,
        // The test account has no automatic payment method enabled. Card is
        // supported by both Stripe test Checkout and the current BRL catalog.
        payment_method_types: ["card"],
        client_reference_id: organizationId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}${returnPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}${returnPath}?checkout=canceled`,
        allow_promotion_codes: input.kind === "subscription",
        billing_address_collection: "auto",
        locale: "auto",
        metadata,
        subscription_data:
          input.kind === "subscription" ? { metadata } : undefined,
        payment_intent_data:
          input.kind === "credit_pack" ? { metadata } : undefined,
      },
      { idempotencyKey: `checkout:${organizationId}:${input.idempotencyKey}` },
    );

    if (!session.url) throw new Error("STRIPE_CHECKOUT_URL_MISSING");
    const { error: sessionError } = await admin
      .from("billing_checkout_sessions")
      .upsert(
        {
          organization_id: organizationId,
          user_id: user.id,
          kind: input.kind,
          plan_id: input.kind === "subscription" ? input.planId : null,
          credit_product_id:
            input.kind === "credit_pack" ? input.creditProductId : null,
          stripe_session_id: session.id,
          stripe_customer_id: customerId,
          status: session.status === "open" ? "open" : "created",
          amount_total: session.amount_total,
          currency: session.currency,
          expires_at: session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
        },
        { onConflict: "stripe_session_id" },
      );
    if (sessionError) throw sessionError;

    return json(
      request,
      { checkoutUrl: session.url, sessionId: session.id, traceId },
      201,
    );
  } catch (error) {
    // Keep the client response generic, while retaining the server-side cause for
    // support and trace-based investigation in Edge Function logs.
    console.error("billing-create-checkout failed", {
      traceId,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
    });
    return errorResponse(request, error, traceId);
  }
});
