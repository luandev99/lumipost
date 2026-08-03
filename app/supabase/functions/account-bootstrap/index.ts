import { authenticate, requirePost } from "../_shared/auth.ts";
import { errorResponse, json, preflight, traceIdFor } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const [
      workspaceResult,
      balanceResult,
      plansResult,
      contentsResult,
      queueResult,
      socialResult,
    ] = await Promise.all([
      client.rpc("get_my_workspace"),
      client.rpc("get_my_credit_balance"),
      client
        .from("plans")
        .select("*")
        .eq("available", true)
        .order("price_cents"),
      client
        .from("contents")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .from("publishing_jobs")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(200),
      client
        .from("social_accounts")
        .select(
          "id,user_id,network,handle,display_name,avatar_url,status,token_expires_at,account_type,biography,followers_count,media_count",
        )
        .order("created_at"),
    ]);
    const firstError = [
      workspaceResult,
      balanceResult,
      plansResult,
      contentsResult,
      queueResult,
      socialResult,
    ].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    return json(request, {
      user: { id: user.id, email: user.email },
      workspace: workspaceResult.data,
      credits: balanceResult.data?.[0] ?? null,
      plans: plansResult.data ?? [],
      contents: contentsResult.data ?? [],
      queue: queueResult.data ?? [],
      socialAccounts: socialResult.data ?? [],
      traceId,
    });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
