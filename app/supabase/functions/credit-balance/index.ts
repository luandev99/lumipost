import { authenticate, requirePost } from "../_shared/auth.ts";
import { errorResponse, json, preflight, traceIdFor } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client } = await authenticate(request);
    const { data, error } = await client.rpc("get_my_credit_balance");
    if (error) throw error;
    return json(request, { credits: data?.[0] ?? null, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
