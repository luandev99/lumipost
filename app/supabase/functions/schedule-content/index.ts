import { z } from "npm:zod@3.24.2";
import { authenticate, requirePost } from "../_shared/auth.ts";
import {
  errorResponse,
  HttpError,
  json,
  preflight,
  traceIdFor,
} from "../_shared/http.ts";

const inputSchema = z
  .object({
    contentId: z.string().uuid(),
    scheduledAt: z.string().datetime({ offset: true }),
    timezone: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?$/),
    socialAccountId: z.string().uuid().nullable().optional(),
    idempotencyKey: z
      .string()
      .min(12)
      .max(200)
      .regex(/^[A-Za-z0-9:_-]+$/),
  })
  .strict();

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(
        422,
        "INVALID_INPUT",
        "Revise os dados do agendamento.",
      );
    const input = parsed.data;
    const { data, error } = await client.rpc("schedule_content", {
      target_content: input.contentId,
      target_scheduled_at: input.scheduledAt,
      target_timezone: input.timezone,
      target_social_account: input.socialAccountId ?? null,
      idem_key: input.idempotencyKey,
    });
    if (error) throw error;
    return json(request, {
      result: data?.[0] ?? null,
      chargedCredits: 2,
      traceId,
    });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
