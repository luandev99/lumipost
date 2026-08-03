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

const metaSchema = z.object({
  id: z.string().trim().min(3).max(300),
  templateId: z.string().trim().min(1).max(180),
  name: z.string().trim().min(1).max(180),
  format: z.enum(["post", "story", "carousel"]),
  packageId: z.string().trim().min(1).max(180),
  aspectRatio: z.string().trim().min(3).max(20),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
  status: z.enum(["draft", "published", "archived"]),
  version: z.number().int().min(1).max(100000),
  slideType: z.string().trim().max(80).optional(),
}).strict();
const templateItemSchema = z.object({
  meta: metaSchema,
  spec: z.record(z.unknown()),
}).strict();
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load"), templateKey: z.string().min(3).max(300) }).strict(),
  z.object({ action: z.literal("save"), item: templateItemSchema }).strict(),
  z.object({
    action: z.literal("import"),
    items: z.array(templateItemSchema).min(1).max(20),
    conflict: z.enum(["replace", "rename", "skip"]),
  }).strict(),
]);

const isSystemAdmin = async (userId: string) => {
  const { data, error } = await createAdminClient().from("profiles")
    .select("system_role,status").eq("id", userId).single();
  if (error) throw error;
  return data.system_role === "system_admin" && data.status === "active";
};

const safeObjectKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);

const saveTemplate = async (
  item: z.infer<typeof templateItemSchema>,
  actorUserId: string,
  conflict: "replace" | "rename" | "skip" = "replace",
) => {
  const admin = createAdminClient();
  let meta = item.meta;
  const { data: existing, error: existingError } = await admin
    .from("visual_templates").select("*").eq("template_key", meta.id).maybeSingle();
  if (existingError) throw existingError;
  if (existing && conflict === "skip") return null;
  if (existing && conflict === "rename") {
    const suffix = crypto.randomUUID().slice(0, 8);
    meta = {
      ...meta,
      id: `${meta.id}-${suffix}`,
      templateId: `${meta.templateId}-${suffix}`,
      name: `${meta.name} (importado)`,
    };
  }
  const nextVersion = existing && conflict !== "rename"
    ? Number(existing.active_version) + 1
    : 1;
  const specText = JSON.stringify(item.spec);
  if (specText.length > 4_500_000)
    throw new HttpError(413, "TEMPLATE_TOO_LARGE", "O JSON do template excede o limite permitido.");
  const objectPath = `global/${safeObjectKey(meta.id)}/v${nextVersion}.json`;
  const upload = await admin.storage.from("template-specs").upload(
    objectPath,
    new TextEncoder().encode(specText),
    { contentType: "application/json", cacheControl: "3600", upsert: false },
  );
  if (upload.error) throw upload.error;
  const payload = {
    template_key: meta.id,
    name: meta.name,
    format: meta.format,
    package_id: meta.packageId,
    aspect_ratio: meta.aspectRatio,
    width: meta.width,
    height: meta.height,
    status: meta.status,
    active_version: nextVersion,
    spec_path: objectPath,
  };
  const result = existing && conflict !== "rename"
    ? await admin.from("visual_templates").update(payload).eq("id", existing.id).select().single()
    : await admin.from("visual_templates").insert(payload).select().single();
  if (result.error) {
    await admin.storage.from("template-specs").remove([objectPath]);
    throw result.error;
  }
  await admin.from("audit_logs").insert({
    actor_user_id: actorUserId,
    action: "admin_template_saved",
    entity_type: "visual_template",
    entity_id: result.data.id,
    after_data: { template_key: meta.id, version: nextVersion, status: meta.status },
  });
  return result.data;
};

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_TEMPLATE_INPUT", "Revise os dados do template.");
    const input = parsed.data;
    const admin = createAdminClient();
    const systemAdmin = await isSystemAdmin(user.id);

    if (input.action === "load") {
      const { data: row, error } = await admin.from("visual_templates")
        .select("*").eq("template_key", input.templateKey).maybeSingle();
      if (error) throw error;
      if (!row || (row.status !== "published" && !systemAdmin))
        throw new HttpError(404, "TEMPLATE_NOT_FOUND", "Template não encontrado.");
      const download = await admin.storage.from("template-specs").download(row.spec_path);
      if (download.error) throw download.error;
      return json(request, {
        spec: JSON.parse(await download.data.text()),
        version: row.active_version,
        traceId,
      });
    }

    if (!systemAdmin)
      throw new HttpError(403, "ADMIN_REQUIRED", "Acesso restrito ao administrador.");
    if (input.action === "save") {
      const saved = await saveTemplate(input.item, user.id);
      return json(request, { saved, traceId });
    }
    const saved = [];
    for (const item of input.items) {
      const value = await saveTemplate(item, user.id, input.conflict);
      if (value) saved.push(value);
    }
    return json(request, { saved, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
