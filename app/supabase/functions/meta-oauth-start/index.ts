import { z } from "npm:zod@3.24.2";
import { authenticate, requirePost } from "../_shared/auth.ts";
import { createAdminClient, metaConfig } from "../_shared/config.ts";
import { randomBase64Url, sha256 } from "../_shared/crypto.ts";
import {
  errorResponse,
  HttpError,
  json,
  preflight,
  traceIdFor,
} from "../_shared/http.ts";

const inputSchema = z
  .object({
    returnPath: z
      .enum(["/social-accounts", "/brand"])
      .default("/social-accounts"),
  })
  .strict();

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const parsed = inputSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      throw new HttpError(422, "INVALID_INPUT", "Destino inválido.");

    const { data: membership, error } = await client
      .from("organization_members")
      .select("organization_id,role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin", "editor"])
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!membership)
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Você não pode conectar esta conta.",
      );

    const state = randomBase64Url(48);
    const { error: stateError } = await createAdminClient()
      .from("meta_oauth_states")
      .insert({
        organization_id: membership.organization_id,
        user_id: user.id,
        state_sha256: await sha256(state),
        return_path: parsed.data.returnPath,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    if (stateError) throw stateError;

    const config = metaConfig();
    const authorizationUrl = new URL(
      "https://www.instagram.com/oauth/authorize",
    );
    authorizationUrl.searchParams.set("client_id", config.appId);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set(
      "scope",
      "instagram_business_basic,instagram_business_content_publish",
    );
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("enable_fb_login", "0");
    authorizationUrl.searchParams.set("force_authentication", "1");

    return json(
      request,
      { authorizationUrl: authorizationUrl.toString(), traceId },
      201,
    );
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
