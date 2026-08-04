import { z } from "npm:zod@3.24.2";
import { createAdminClient, required } from "../_shared/config.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";
import { generateAiContent } from "../_shared/content-generation.ts";

const inputSchema = z
  .object({ batchSize: z.number().int().min(1).max(10).default(5) })
  .strict();

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

type WeeklySlot = {
  id: string;
  organization_id: string;
  weekly_plan_id: string;
  day: string;
  local_time: string;
  scheduled_at: string | null;
  format: "post" | "carousel" | "story" | "reel" | "video" | "caption";
  topic: string;
  slides: number;
  draft: Record<string, unknown>;
};

// Este worker é chamado pelo pg_cron a cada minuto. Criado uma única vez por
// isolate (fora do handler), o cliente admin reaproveita a mesma conexão
// HTTP/keep-alive entre execuções, em vez de abrir uma nova a cada tick.
const admin = createAdminClient();

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  const workerSecret = request.headers.get("x-worker-secret") ?? "";
  if (!constantTimeEqual(workerSecret, required("PUBLISH_WORKER_SECRET")))
    return response({ error: "UNAUTHORIZED" }, 401);
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return response({ error: "INVALID_INPUT" }, 422);

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_due_weekly_slots_service",
    { batch_size: parsed.data.batchSize },
  );
  if (claimError) return response({ error: "CLAIM_FAILED" }, 500);

  // Cron não deve ficar preso por muito tempo — geração de carrossel roda
  // várias imagens em sequência e pode passar do limite de execução da
  // plataforma. Em vez de deixar a função morrer no meio (o que travava o
  // slot em "processing" para sempre), devolve o resto do lote pro próximo
  // tick assim que o orçamento de tempo estoura.
  const MAX_WALL_CLOCK_MS = 45_000;
  const startedAt = Date.now();
  const claimedSlots = (claimed ?? []) as WeeklySlot[];
  const results: Array<{ id: string; status: string }> = [];
  for (let index = 0; index < claimedSlots.length; index += 1) {
    if (Date.now() - startedAt > MAX_WALL_CLOCK_MS) {
      const remainingIds = claimedSlots.slice(index).map((remaining) => remaining.id);
      await admin
        .from("weekly_slots")
        .update({ status: "pending", locked_at: null })
        .in("id", remainingIds);
      break;
    }
    const slot = claimedSlots[index];
    const fail = async (errorCode: string) => {
      await admin
        .from("weekly_slots")
        .update({ status: "failed", error_code: errorCode.slice(0, 300) })
        .eq("id", slot.id);
      results.push({ id: slot.id, status: "failed" });
    };
    try {
      const { data: plan, error: planError } = await admin
        .from("weekly_plans")
        .select("user_id,status")
        .eq("id", slot.weekly_plan_id)
        .single();
      if (planError || !plan) throw new Error("PLAN_NOT_FOUND");
      if (plan.status === "canceled") {
        await fail("PLAN_CANCELED");
        continue;
      }

      const draft = slot.draft ?? {};
      // Reel/vídeo por IA nunca é auto-agendado: precisa do vídeo real do
      // Higgsfield pronto e revisado primeiro (guard VIDEO_UPLOAD_REQUIRED
      // em generateAiContent). O horário do slot só organiza o planejamento
      // visualmente — o conteúdo nasce rascunho e o agendamento é manual.
      const isVideoFormat = slot.format === "reel" || slot.format === "video";
      let socialAccountId = draft.socialAccountId as string | undefined;
      if (slot.scheduled_at && !isVideoFormat && !socialAccountId) {
        const { data: account, error: accountError } = await admin
          .from("social_accounts")
          .select("id")
          .eq("organization_id", slot.organization_id)
          .eq("network", "instagram")
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (accountError) throw accountError;
        if (!account) {
          await fail("SOCIAL_ACCOUNT_NOT_FOUND");
          continue;
        }
        socialAccountId = account.id;
      }
      const result = await generateAiContent(admin, {
        organizationId: slot.organization_id,
        userId: plan.user_id,
        input: {
          ...draft,
          idempotencyKey: `week:${slot.weekly_plan_id}:${slot.id}`,
          topic: slot.topic,
          objective: (draft.objective as string | undefined) ?? "Planejamento semanal",
          style: (draft.style as string | undefined) ?? "Identidade da marca",
          format: slot.format,
          slides: slot.format === "carousel" ? slot.slides : undefined,
          scheduledAt: slot.scheduled_at && !isVideoFormat
            ? new Date(slot.scheduled_at).toISOString()
            : undefined,
          timezone: "America/Sao_Paulo",
          socialAccountId: isVideoFormat ? undefined : socialAccountId,
        },
      });

      await admin
        .from("weekly_slots")
        .update({
          status: "completed",
          content_id: result.contentId,
          error_code: null,
        })
        .eq("id", slot.id);
      results.push({ id: slot.id, status: "completed" });
    } catch (error) {
      // Erros do Postgrest são objetos simples, não instâncias de Error —
      // sem isso, qualquer falha de banco virava um "WEEKLY_SLOT_GENERATION_FAILED"
      // genérico e a razão real ficava só em content_generation_requests.
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "WEEKLY_SLOT_GENERATION_FAILED";
      await fail(message);
    }
  }

  return response({ claimed: (claimed ?? []).length, results });
});
