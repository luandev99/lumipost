import { authenticate, requirePost } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/config.ts";
import { errorResponse, HttpError, json, preflight, traceIdFor } from "../_shared/http.ts";
import { generateAiContent, generateAiContentInputSchema } from "../_shared/content-generation.ts";

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { user } = await authenticate(request);
    const parsed = generateAiContentInputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_INPUT", "Revise os dados do conteúdo.");

    const admin = createAdminClient();
    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw new Error("WORKSPACE_NOT_FOUND");

    const result = await generateAiContent(admin, {
      organizationId: membership.organization_id,
      userId: user.id,
      input: parsed.data,
    });
    return json(request, { ...result, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
