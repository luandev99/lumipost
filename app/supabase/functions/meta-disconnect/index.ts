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

const inputSchema = z.object({ socialAccountId: z.string().uuid() }).strict();

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_INPUT", "Conta inválida.");
    const { data: account, error } = await client
      .from("social_accounts")
      .select("id,organization_id")
      .eq("id", parsed.data.socialAccountId)
      .maybeSingle();
    if (error) throw error;
    if (!account)
      throw new HttpError(
        404,
        "SOCIAL_ACCOUNT_NOT_FOUND",
        "Conta não encontrada.",
      );

    const { data: membership } = await client
      .from("organization_members")
      .select("role")
      .eq("organization_id", account.organization_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!membership)
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Você não pode desconectar esta conta.",
      );

    const admin = createAdminClient();
    const { error: deleteError } = await admin.rpc(
      "delete_social_token_service",
      { target_account: account.id },
    );
    if (deleteError) throw deleteError;
    await admin
      .from("brands")
      .update({ instagram_connected: false })
      .eq("organization_id", account.organization_id)
      .eq("is_default", true);
    await admin.from("audit_logs").insert({
      organization_id: account.organization_id,
      actor_user_id: user.id,
      action: "instagram_disconnected",
      entity_type: "social_account",
      entity_id: account.id,
    });
    return json(request, { disconnected: true, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
