import { authenticate, requirePost } from "../_shared/auth.ts";
import { appUrl, createAdminClient } from "../_shared/config.ts";
import {
  errorResponse,
  HttpError,
  json,
  preflight,
  traceIdFor,
} from "../_shared/http.ts";
import { getStripe } from "../_shared/stripe.ts";

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const { data: membership, error } = await client
      .from("organization_members")
      .select("organization_id,role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!membership)
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Você não pode gerenciar esta assinatura.",
      );

    const admin = createAdminClient();
    const { data: customer, error: customerError } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("organization_id", membership.organization_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer)
      throw new HttpError(
        404,
        "BILLING_CUSTOMER_NOT_FOUND",
        "Nenhuma cobrança encontrada para esta conta.",
      );

    const session = await getStripe().billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${appUrl()}/credits`,
    });
    return json(request, { portalUrl: session.url, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
