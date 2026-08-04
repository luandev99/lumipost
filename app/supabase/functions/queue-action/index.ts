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

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reschedule"),
    jobId: z.string().uuid(),
    scheduledAt: z.string().datetime({ offset: true }),
    timezone: z.string().trim().min(3).max(80).default("America/Sao_Paulo"),
  }).strict(),
  z.object({ action: z.literal("cancel"), jobId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("retry"), jobId: z.string().uuid() }).strict(),
]);

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_INPUT", "Revise a operação da fila.");
    const input = parsed.data;
    if (
      input.action === "reschedule" &&
      new Date(input.scheduledAt).getTime() < Date.now() + 60 * 60 * 1000
    )
      throw new HttpError(
        422,
        "SCHEDULE_MUST_BE_AT_LEAST_1H_AHEAD",
        "Escolha um horário com pelo menos 1 hora de antecedência.",
      );

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("system_role,status")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (profile.status !== "active")
      throw new HttpError(403, "ACCOUNT_SUSPENDED", "Esta conta está suspensa.");
    const { data: job, error: jobError } = await admin
      .from("publishing_jobs")
      .select("*,contents!inner(user_id,organization_id)")
      .eq("id", input.jobId)
      .single();
    if (jobError) throw jobError;
    const organizationId = job.contents.organization_id;
    if (profile.system_role !== "system_admin") {
      const { data: membership, error: membershipError } = await admin
        .from("organization_members")
        .select("role,status")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership || membership.status !== "active" ||
        !["owner", "admin", "editor"].includes(membership.role))
        throw new HttpError(403, "FORBIDDEN", "Você não pode alterar esta publicação.");
    }

    if (input.action === "cancel") {
      if (["published", "publishing"].includes(job.status))
        throw new HttpError(409, "INVALID_JOB_STATE", "Esta publicação não pode ser cancelada.");
      const { error } = await admin.from("publishing_jobs")
        .update({ status: "canceled", next_attempt_at: null })
        .eq("id", job.id);
      if (error) throw error;
      await admin.from("contents").update({ status: "canceled" }).eq("id", job.content_id);
    } else if (input.action === "retry") {
      if (!["failed", "paused", "canceled"].includes(job.status))
        throw new HttpError(409, "INVALID_JOB_STATE", "Esta publicação não pode ser repetida.");
      const scheduledAt = new Date(Date.now() + 15_000).toISOString();
      const { error } = await admin.from("publishing_jobs").update({
        status: "scheduled",
        scheduled_at: scheduledAt,
        next_attempt_at: null,
        last_error_code: null,
        last_error_message: null,
      }).eq("id", job.id);
      if (error) throw error;
      await admin.from("contents").update({
        status: "scheduled",
        scheduled_at: scheduledAt,
        failure_reason: null,
      }).eq("id", job.content_id);
    } else {
      if (!["scheduled", "retry_scheduled", "paused", "failed"].includes(job.status))
        throw new HttpError(409, "INVALID_JOB_STATE", "Esta publicação não pode ser reagendada.");
      const { error } = await admin.from("publishing_jobs").update({
        status: "scheduled",
        scheduled_at: input.scheduledAt,
        timezone: input.timezone,
        next_attempt_at: null,
        last_error_code: null,
        last_error_message: null,
      }).eq("id", job.id);
      if (error) throw error;
      await admin.from("contents").update({
        status: "scheduled",
        scheduled_at: input.scheduledAt,
        failure_reason: null,
      }).eq("id", job.content_id);
    }
    await admin.from("audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      action: `queue_${input.action}`,
      entity_type: "publishing_job",
      entity_id: job.id,
      before_data: { status: job.status, scheduled_at: job.scheduled_at },
      after_data: input,
    });
    return json(request, { updated: true, jobId: job.id, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
