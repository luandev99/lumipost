import { z } from "npm:zod@3.24.2";
import { createAdminClient, required } from "../_shared/config.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";
import { checkVideoJob } from "../_shared/higgsfield.ts";

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

type VideoJob = {
  id: string;
  organization_id: string;
  content_id: string;
  provider_request_id: string;
};

// Chamado pelo pg_cron a cada minuto — criado uma única vez por isolate para
// reaproveitar a mesma conexão entre execuções, em vez de abrir uma nova a
// cada tick.
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
    "claim_video_generation_jobs_service",
    { batch_size: parsed.data.batchSize },
  );
  if (claimError) return response({ error: "CLAIM_FAILED" }, 500);

  const results: Array<{ id: string; status: string }> = [];
  for (const job of (claimed ?? []) as VideoJob[]) {
    const fail = async (errorCode: string) => {
      await admin
        .from("video_generation_jobs")
        .update({ status: "failed", error_code: errorCode.slice(0, 300) })
        .eq("id", job.id);
      await admin
        .from("contents")
        .update({ status: "failed", failure_reason: errorCode.slice(0, 500) })
        .eq("id", job.content_id);
      results.push({ id: job.id, status: "failed" });
    };
    try {
      const check = await checkVideoJob(job.provider_request_id);
      if (check.status === "failed" || check.status === "nsfw") {
        await fail(`HIGGSFIELD_${check.status.toUpperCase()}`);
        continue;
      }
      if (check.status !== "completed" || !check.videoUrl) {
        results.push({ id: job.id, status: "processing" });
        continue;
      }

      const videoResponse = await fetch(check.videoUrl);
      if (!videoResponse.ok)
        throw new Error(`VIDEO_DOWNLOAD_FAILED:${videoResponse.status}`);
      const bytes = new Uint8Array(await videoResponse.arrayBuffer());

      const { data: content, error: contentError } = await admin
        .from("contents")
        .select("media_paths")
        .eq("id", job.content_id)
        .single();
      if (contentError || !content)
        throw contentError ?? new Error("CONTENT_NOT_FOUND");

      const objectPath = `${job.organization_id}/video/${job.content_id}/video.mp4`;
      const upload = await admin.storage.from("generated-media").upload(
        objectPath,
        bytes,
        { contentType: "video/mp4", cacheControl: "31536000", upsert: true },
      );
      if (upload.error) throw upload.error;

      const mediaPaths = Array.isArray(content.media_paths)
        ? (content.media_paths as string[])
        : [];
      await admin
        .from("contents")
        .update({
          status: "draft",
          media_paths: [...mediaPaths, `generated-media/${objectPath}`],
          failure_reason: null,
        })
        .eq("id", job.content_id);
      await admin
        .from("video_generation_jobs")
        .update({ status: "completed", error_code: null })
        .eq("id", job.id);
      results.push({ id: job.id, status: "completed" });
    } catch (error) {
      await fail(
        error instanceof Error ? error.message : "VIDEO_POLL_FAILED",
      );
    }
  }

  return response({ claimed: (claimed ?? []).length, results });
});
