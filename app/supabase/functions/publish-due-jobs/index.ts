import { z } from "npm:zod@3.24.2";
import { createAdminClient, required } from "../_shared/config.ts";
import { getMetaContainerStatus, postMetaForm } from "../_shared/meta.ts";

const inputSchema = z
  .object({ batchSize: z.number().int().min(1).max(10).default(5) })
  .strict();
const allowedBuckets = new Set([
  "content-uploads",
  "generated-media",
  "content-renders",
]);

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

type Job = {
  id: string;
  organization_id: string;
  content_id: string;
  social_account_id: string | null;
  attempts: number;
  max_attempts: number;
  external_container_id: string | null;
  provider_response: Record<string, unknown> | null;
};

// Chamado pelo cron de publicação recorrentemente — criado uma única vez por
// isolate para reaproveitar a mesma conexão entre execuções, em vez de abrir
// uma nova a cada tick.
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
    "claim_due_publishing_jobs_service",
    {
      batch_size: parsed.data.batchSize,
    },
  );
  if (claimError) return response({ error: "CLAIM_FAILED" }, 500);

  const results: Array<{ id: string; status: string }> = [];
  for (const rawJob of (claimed ?? []) as Job[]) {
    const job = rawJob;
    const retry = async (code: string, message: string, delaySeconds = 60) => {
      const terminal = job.attempts >= job.max_attempts;
      await admin
        .from("publishing_jobs")
        .update({
          status: terminal ? "failed" : "retry_scheduled",
          next_attempt_at: terminal
            ? null
            : new Date(Date.now() + delaySeconds * 1000).toISOString(),
          last_error_code: code.slice(0, 120),
          last_error_message: message.slice(0, 500),
          locked_at: null,
          lock_token: null,
        })
        .eq("id", job.id);
      if (terminal)
        await admin
          .from("contents")
          .update({ status: "failed", failure_reason: message.slice(0, 500) })
          .eq("id", job.content_id);
      results.push({
        id: job.id,
        status: terminal ? "failed" : "retry_scheduled",
      });
    };

    try {
      if (!job.social_account_id) throw new Error("SOCIAL_ACCOUNT_REQUIRED");
      const [contentResult, accountResult, tokenResult] = await Promise.all([
        admin
          .from("contents")
          .select("*")
          .eq("id", job.content_id)
          .eq("organization_id", job.organization_id)
          .single(),
        admin
          .from("social_accounts")
          .select("*")
          .eq("id", job.social_account_id)
          .eq("organization_id", job.organization_id)
          .single(),
        admin.rpc("read_social_token_service", {
          target_account: job.social_account_id,
        }),
      ]);
      if (contentResult.error || !contentResult.data)
        throw new Error("CONTENT_NOT_FOUND");
      if (accountResult.error || !accountResult.data)
        throw new Error("SOCIAL_ACCOUNT_NOT_FOUND");
      if (tokenResult.error || typeof tokenResult.data !== "string")
        throw new Error("SOCIAL_TOKEN_NOT_FOUND");
      const content = contentResult.data;
      const account = accountResult.data;
      const token = tokenResult.data;
      if (account.status !== "active")
        throw new Error("SOCIAL_ACCOUNT_INACTIVE");
      if (
        account.token_expires_at &&
        new Date(account.token_expires_at).getTime() <= Date.now()
      ) {
        await admin
          .from("social_accounts")
          .update({ status: "expired" })
          .eq("id", account.id);
        throw new Error("SOCIAL_TOKEN_EXPIRED");
      }

      const signedUrl = async (storedPath: string): Promise<string> => {
        if (
          storedPath.startsWith("http://") ||
          storedPath.startsWith("https://")
        )
          throw new Error("EXTERNAL_MEDIA_URL_NOT_ALLOWED");
        const normalized = storedPath.replace(/^\//, "");
        const segments = normalized.split("/");
        const bucket = allowedBuckets.has(segments[0])
          ? segments.shift()!
          : "content-renders";
        const objectPath = segments.join("/");
        if (
          !objectPath.startsWith(`${job.organization_id}/`) ||
          objectPath.includes("..")
        )
          throw new Error("INVALID_MEDIA_PATH");
        const { data, error } = await admin.storage
          .from(bucket)
          .createSignedUrl(objectPath, 60 * 60);
        if (error || !data?.signedUrl) throw new Error("MEDIA_SIGNING_FAILED");
        return data.signedUrl;
      };
      const paths = Array.isArray(content.media_paths)
        ? (content.media_paths as string[])
        : [];
      if (paths.length === 0) throw new Error("CONTENT_MEDIA_MISSING");
      const caption =
        `${content.caption ?? ""}${Array.isArray(content.hashtags) && content.hashtags.length ? `\n\n${content.hashtags.join(" ")}` : ""}`.slice(
          0,
          2200,
        );
      const providerState = (job.provider_response ?? {}) as Record<
        string,
        unknown
      >;
      let containerId = job.external_container_id;

      if (content.format === "carousel") {
        let children = Array.isArray(providerState.child_container_ids)
          ? providerState.child_container_ids.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        if (children.length === 0) {
          if (paths.length < 2 || paths.length > 10)
            throw new Error("INVALID_CAROUSEL_SIZE");
          children = [];
          for (const path of paths) {
            const isVideo = /\.mp4$/i.test(path);
            const child = await postMetaForm<{ id: string }>(
              `${account.external_account_id}/media`,
              token,
              {
                ...(isVideo
                  ? { media_type: "VIDEO", video_url: await signedUrl(path) }
                  : { image_url: await signedUrl(path) }),
                is_carousel_item: "true",
              },
            );
            children.push(child.id);
          }
          await admin
            .from("publishing_jobs")
            .update({
              status: "retry_scheduled",
              next_attempt_at: new Date(Date.now() + 20_000).toISOString(),
              provider_status: "CAROUSEL_CHILDREN_CREATED",
              provider_response: { child_container_ids: children },
              locked_at: null,
              lock_token: null,
            })
            .eq("id", job.id);
          results.push({ id: job.id, status: "processing" });
          continue;
        }
        const childStatuses = await Promise.all(
          children.map((id) => getMetaContainerStatus(id, token)),
        );
        if (
          childStatuses.some(
            (item) =>
              item.status_code === "ERROR" || item.status_code === "EXPIRED",
          )
        ) {
          throw new Error("META_CAROUSEL_CHILD_FAILED");
        }
        if (
          childStatuses.some(
            (item) =>
              item.status_code !== "FINISHED" &&
              item.status_code !== "PUBLISHED",
          )
        ) {
          await retry(
            "META_CONTAINER_PROCESSING",
            "O Instagram ainda está processando os slides.",
            30,
          );
          continue;
        }
        if (!containerId) {
          const parent = await postMetaForm<{ id: string }>(
            `${account.external_account_id}/media`,
            token,
            {
              media_type: "CAROUSEL",
              children: children.join(","),
              caption,
            },
          );
          containerId = parent.id;
          await admin
            .from("publishing_jobs")
            .update({
              status: "retry_scheduled",
              next_attempt_at: new Date(Date.now() + 20_000).toISOString(),
              external_container_id: containerId,
              provider_status: "CAROUSEL_PARENT_CREATED",
              provider_response: { child_container_ids: children },
              locked_at: null,
              lock_token: null,
            })
            .eq("id", job.id);
          results.push({ id: job.id, status: "processing" });
          continue;
        }
      } else if (!containerId) {
        const mediaUrl = await signedUrl(paths[0]);
        const fields: Record<string, string> = { caption };
        if (content.format === "reel") {
          if (!/\.mp4$/i.test(paths[0])) throw new Error("REEL_REQUIRES_MP4");
          fields.media_type = "REELS";
          fields.video_url = mediaUrl;
          fields.share_to_feed = "true";
        } else if (content.format === "story") {
          if (account.account_type !== "BUSINESS")
            throw new Error("STORIES_REQUIRE_BUSINESS_ACCOUNT");
          fields.media_type = "STORIES";
          if (/\.mp4(?:$|\?)/i.test(paths[0])) fields.video_url = mediaUrl;
          else fields.image_url = mediaUrl;
          delete fields.caption;
        } else if (content.format === "post") {
          fields.image_url = mediaUrl;
        } else {
          throw new Error("UNSUPPORTED_CONTENT_FORMAT");
        }
        const created = await postMetaForm<{ id: string }>(
          `${account.external_account_id}/media`,
          token,
          fields,
        );
        containerId = created.id;
        await admin
          .from("publishing_jobs")
          .update({
            external_container_id: containerId,
            provider_status: "CONTAINER_CREATED",
          })
          .eq("id", job.id);
      }

      if (!containerId) throw new Error("META_CONTAINER_MISSING");
      const container = await getMetaContainerStatus(containerId, token);
      if (
        container.status_code === "ERROR" ||
        container.status_code === "EXPIRED"
      )
        throw new Error("META_CONTAINER_FAILED");
      if (
        container.status_code !== "FINISHED" &&
        container.status_code !== "PUBLISHED"
      ) {
        await retry(
          "META_CONTAINER_PROCESSING",
          "O Instagram ainda está processando a mídia.",
          30,
        );
        continue;
      }

      const published = await postMetaForm<{ id: string }>(
        `${account.external_account_id}/media_publish`,
        token,
        {
          creation_id: containerId,
        },
      );
      const publishedAt = new Date().toISOString();
      await admin
        .from("publishing_jobs")
        .update({
          status: "published",
          external_post_id: published.id,
          provider_status: "PUBLISHED",
          provider_response: { ...providerState, media_id: published.id },
          published_at: publishedAt,
          last_error_code: null,
          last_error_message: null,
          locked_at: null,
          lock_token: null,
        })
        .eq("id", job.id);
      await admin
        .from("contents")
        .update({
          status: "published",
          published_at: publishedAt,
          failure_reason: null,
        })
        .eq("id", job.content_id);
      await admin.from("audit_logs").insert({
        organization_id: job.organization_id,
        action: "instagram_content_published",
        entity_type: "publishing_job",
        entity_id: job.id,
        after_data: { external_post_id: published.id, attempts: job.attempts },
      });
      results.push({ id: job.id, status: "published" });
    } catch (error) {
      const code =
        error instanceof Error ? error.message.split(":")[0] : "PUBLISH_FAILED";
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível publicar no Instagram.";
      await retry(
        code,
        message,
        Math.min(15 * 2 ** Math.max(0, job.attempts - 1), 15 * 60),
      );
    }
  }

  return response({ claimed: (claimed ?? []).length, results });
});
