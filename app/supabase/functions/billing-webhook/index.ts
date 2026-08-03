import Stripe from "npm:stripe@17.7.0";
import { createAdminClient, stripeWebhookSecret } from "../_shared/config.ts";
import { getStripe, stripeSubscriptionStatus } from "../_shared/stripe.ts";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
};

const subscriptionIdOf = (
  value: string | Stripe.Subscription | null | undefined,
) => (typeof value === "string" ? value : value?.id);

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return response({ error: "MISSING_SIGNATURE" }, 400);

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSecret(),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return response({ error: "INVALID_SIGNATURE" }, 400);
  }

  const admin = createAdminClient();
  const digest = await sha256(rawBody);
  const { error: claimError } = await admin.from("billing_events").insert({
    provider_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    payload_sha256: digest,
  });
  if (claimError?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("billing_events")
      .select("processing_status,payload_sha256")
      .eq("provider_event_id", event.id)
      .single();
    if (existingError || !existing)
      return response({ error: "EVENT_READ_FAILED" }, 500);
    if (existing.payload_sha256 !== digest)
      return response({ error: "EVENT_PAYLOAD_MISMATCH" }, 400);
    if (["processed", "ignored"].includes(existing.processing_status))
      return response({ received: true, duplicate: true });
    if (existing.processing_status === "processing")
      return response({ error: "EVENT_IN_PROGRESS" }, 409);
    const { data: reclaimed, error: reclaimError } = await admin
      .from("billing_events")
      .update({
        processing_status: "processing",
        error_code: null,
        processed_at: null,
      })
      .eq("provider_event_id", event.id)
      .eq("processing_status", "failed")
      .select("provider_event_id")
      .maybeSingle();
    if (reclaimError || !reclaimed)
      return response({ error: "EVENT_RECLAIM_FAILED" }, 409);
  }
  if (claimError) return response({ error: "EVENT_CLAIM_FAILED" }, 500);

  const mark = async (
    status: "processed" | "ignored" | "failed",
    errorCode?: string,
  ) => {
    await admin
      .from("billing_events")
      .update({
        processing_status: status,
        error_code: errorCode ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("provider_event_id", event.id);
  };

  const syncSubscription = async (
    subscription: Stripe.Subscription,
    fallbackPlanId?: string,
  ) => {
    const organizationId = subscription.metadata.organization_id;
    const userId = subscription.metadata.supabase_user_id;
    const planId = subscription.metadata.catalog_id ?? fallbackPlanId;
    if (
      !organizationId ||
      !userId ||
      !planId ||
      !["month", "year"].includes(planId)
    ) {
      throw new Error("INVALID_SUBSCRIPTION_METADATA");
    }
    const { data: plan, error: planError } = await admin
      .from("plans")
      .select("*")
      .eq("id", planId)
      .single();
    if (planError || !plan) throw new Error("PLAN_NOT_FOUND");

    const startsAt = new Date(
      subscription.current_period_start * 1000,
    ).toISOString();
    const expiresAt = new Date(
      subscription.current_period_end * 1000,
    ).toISOString();
    const mappedStatus = stripeSubscriptionStatus(subscription.status);
    const snapshot = {
      name: plan.name,
      price_cents: plan.price_cents,
      currency: plan.currency,
      credits: plan.credits,
      duration_days: plan.duration_days,
      stripe_product_id:
        typeof subscription.items.data[0]?.price.product === "string"
          ? subscription.items.data[0]?.price.product
          : subscription.items.data[0]?.price.product?.id,
      stripe_price_id: subscription.items.data[0]?.price.id,
    };

    const { data: current } = await admin
      .from("subscriptions")
      .select("id")
      .eq("provider_subscription_id", subscription.id)
      .maybeSingle();
    if (mappedStatus === "active") {
      await admin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .neq("provider_subscription_id", subscription.id);
    }
    const payload = {
      organization_id: organizationId,
      user_id: userId,
      plan_id: planId,
      status: mappedStatus,
      provider: "stripe",
      provider_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      provider_subscription_id: subscription.id,
      plan_snapshot: snapshot,
      starts_at: startsAt,
      expires_at: expiresAt,
      cancel_at_period_end: subscription.cancel_at_period_end,
    };
    const writeResult = current
      ? await admin.from("subscriptions").update(payload).eq("id", current.id)
      : await admin.from("subscriptions").insert(payload);
    if (writeResult.error) throw writeResult.error;
    return { organizationId, userId, plan };
  };

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organization_id;
      const userId = session.metadata?.supabase_user_id;
      const kind = session.metadata?.purchase_kind;
      const catalogId = session.metadata?.catalog_id;
      if (!organizationId || !userId || !kind || !catalogId)
        throw new Error("INVALID_CHECKOUT_METADATA");

      await admin
        .from("billing_checkout_sessions")
        .update({
          status: "paid",
          amount_total: session.amount_total,
          currency: session.currency,
          completed_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id);

      if (kind === "credit_pack") {
        if (session.payment_status !== "paid")
          throw new Error("PAYMENT_NOT_PAID");
        const { data: product, error } = await admin
          .from("credit_products")
          .select("id,credits,available")
          .eq("id", catalogId)
          .single();
        if (error || !product?.available)
          throw new Error("CREDIT_PRODUCT_NOT_FOUND");
        const { error: grantError } = await admin.rpc("grant_credits_service", {
          target_org: organizationId,
          amount_to_grant: product.credits,
          idem_key: `stripe:${event.id}`,
          ref_type: "stripe_credit_purchase",
          ref_id: null,
          actor_id: userId,
        });
        if (grantError) throw grantError;
      } else if (kind === "subscription") {
        const subscriptionId = subscriptionIdOf(session.subscription);
        if (!subscriptionId) throw new Error("SUBSCRIPTION_NOT_FOUND");
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const synced = await syncSubscription(subscription, catalogId);
        const { error: grantError } = await admin.rpc("grant_credits_service", {
          target_org: synced.organizationId,
          amount_to_grant: synced.plan.credits,
          idem_key: `stripe:initial:${session.id}`,
          ref_type: "stripe_subscription_initial",
          ref_id: null,
          actor_id: synced.userId,
        });
        if (grantError) throw grantError;
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason !== "subscription_create") {
        const subscriptionId = subscriptionIdOf(invoice.subscription);
        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const synced = await syncSubscription(subscription);
          const { error } = await admin.rpc("grant_credits_service", {
            target_org: synced.organizationId,
            amount_to_grant: synced.plan.credits,
            idem_key: `stripe:${event.id}`,
            ref_type: "stripe_subscription_renewal",
            ref_id: null,
            actor_id: synced.userId,
          });
          if (error) throw error;
        }
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdOf(invoice.subscription);
      if (subscriptionId) {
        const { error } = await admin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("provider_subscription_id", subscriptionId);
        if (error) throw error;
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await admin
        .from("billing_checkout_sessions")
        .update({ status: "expired" })
        .eq("stripe_session_id", session.id);
    } else {
      await mark("ignored");
      return response({ received: true, ignored: true });
    }

    await admin.from("audit_logs").insert({
      organization_id:
        (event.data.object as { metadata?: Record<string, string> }).metadata
          ?.organization_id ?? null,
      action: "stripe_webhook_processed",
      entity_type: "billing_event",
      entity_id: event.id,
      after_data: { event_type: event.type, livemode: event.livemode },
    });
    await mark("processed");
    return response({ received: true });
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message.slice(0, 120)
        : "PROCESSING_FAILED";
    console.error(
      JSON.stringify({
        level: "error",
        eventId: event.id,
        eventType: event.type,
        code,
      }),
    );
    await mark("failed", code);
    return response({ error: "PROCESSING_FAILED" }, 500);
  }
});
