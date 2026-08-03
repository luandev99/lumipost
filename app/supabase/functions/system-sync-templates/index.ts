import { createAdminClient, required } from "../_shared/config.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";

type CatalogItem = {
  id: string;
  name: string;
  format: "post" | "story" | "carousel";
  packageId: string;
  aspectRatio: string;
  width: number;
  height: number;
  path: string;
  status?: "draft" | "published" | "archived";
};

const safe = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const provided = request.headers.get("x-worker-secret") ?? "";
  if (!constantTimeEqual(provided, required("PUBLISH_WORKER_SECRET")))
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { offset?: number; limit?: number };
  const offset = Math.max(0, Math.floor(body.offset ?? 0));
  const limit = Math.min(50, Math.max(1, Math.floor(body.limit ?? 25)));
  const appUrl = required("APP_URL").replace(/\/$/, "");
  const catalogResponse = await fetch(`${appUrl}/templates/catalog.json`);
  if (!catalogResponse.ok)
    return Response.json({ error: "CATALOG_FETCH_FAILED" }, { status: 502 });
  const catalog = await catalogResponse.json() as CatalogItem[];
  const batch = catalog.slice(offset, offset + limit);
  const admin = createAdminClient();
  const results: Array<{ id: string; status: "synced" | "failed"; error?: string }> = [];
  // Processa grupos pequenos em paralelo. Isso mantém a função abaixo do
  // timeout sem abrir centenas de conexões simultâneas ao Storage/PostgREST.
  for (let cursor = 0; cursor < batch.length; cursor += 10) {
    const group = batch.slice(cursor, cursor + 10);
    const groupResults = await Promise.all(group.map(async (meta) => {
      try {
        const specResponse = await fetch(new URL(meta.path, `${appUrl}/`));
        if (!specResponse.ok) throw new Error(`SPEC_FETCH_${specResponse.status}`);
        const bytes = new Uint8Array(await specResponse.arrayBuffer());
        const objectPath = `global/builtin/${safe(meta.id)}.json`;
        const upload = await admin.storage.from("template-specs").upload(
          objectPath,
          bytes,
          { contentType: "application/json", cacheControl: "31536000", upsert: true },
        );
        if (upload.error) throw upload.error;
        const { error } = await admin.from("visual_templates").upsert({
          template_key: meta.id,
          name: meta.name,
          format: meta.format,
          package_id: meta.packageId,
          aspect_ratio: meta.aspectRatio,
          width: meta.width,
          height: meta.height,
          status: meta.status ?? "published",
          active_version: 1,
          spec_path: objectPath,
        }, { onConflict: "template_key" });
        if (error) throw error;
        return { id: meta.id, status: "synced" as const };
      } catch (error) {
        return {
          id: meta.id,
          status: "failed" as const,
          error: error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN",
        };
      }
    }));
    results.push(...groupResults);
  }
  const { count: persistedTotal, error: countError } = await admin
    .from("visual_templates")
    .select("id", { count: "exact", head: true });
  if (countError) {
    return Response.json({ error: "TEMPLATE_COUNT_FAILED" }, { status: 500 });
  }
  return Response.json({
    offset,
    processed: batch.length,
    total: catalog.length,
    persistedTotal,
    nextOffset: offset + batch.length,
    results,
  });
});
