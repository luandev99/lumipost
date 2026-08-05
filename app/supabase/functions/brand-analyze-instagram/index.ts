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
import { runBrandAnalysis } from "../_shared/brand-analysis.ts";

const inputSchema = z
  .object({
    brandId: z.string().uuid(),
    socialAccountId: z.string().uuid(),
    applyAutomatically: z.boolean().default(true),
  })
  .strict();

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);

  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(
        422,
        "INVALID_INPUT",
        "Selecione a marca e a conta do Instagram.",
      );

    const [brandResult, accountResult] = await Promise.all([
      client
        .from("brands")
        .select("id,organization_id")
        .eq("id", parsed.data.brandId)
        .maybeSingle(),
      client
        .from("social_accounts")
        .select("id,organization_id,status")
        .eq("id", parsed.data.socialAccountId)
        .maybeSingle(),
    ]);
    if (brandResult.error) throw brandResult.error;
    if (accountResult.error) throw accountResult.error;
    const brand = brandResult.data;
    const account = accountResult.data;
    if (
      !brand ||
      !account ||
      brand.organization_id !== account.organization_id ||
      account.status !== "active"
    ) {
      throw new HttpError(
        404,
        "SOCIAL_ACCOUNT_NOT_FOUND",
        "Conta do Instagram não encontrada ou expirada.",
      );
    }

    const result = await runBrandAnalysis(createAdminClient(), {
      brandId: brand.id,
      organizationId: brand.organization_id,
      socialAccountId: account.id,
      requestedBy: user.id,
      applyAutomatically: parsed.data.applyAutomatically,
    });

    return json(request, { ...result, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
