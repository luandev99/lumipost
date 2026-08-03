import { z } from "npm:zod@3.24.2";
import { authenticate, requirePost } from "../_shared/auth.ts";
import {
  errorResponse,
  HttpError,
  json,
  preflight,
  traceIdFor,
} from "../_shared/http.ts";
import { generateContentDraftsWithOpenAI } from "../_shared/openai.ts";
import { createAdminClient } from "../_shared/config.ts";
import { selectVisualTemplate } from "../_shared/template-selection.ts";

const formats = ["post", "carousel", "story", "reel", "video", "caption"] as const;
const inputSchema = z.object({
  objective: z.string().trim().min(3).max(300),
  topic: z.string().trim().min(3).max(500),
  format: z.enum(formats),
  style: z.string().trim().min(2).max(120),
  instructions: z.string().trim().max(1500).optional(),
  variations: z.number().int().min(1).max(3).default(3),
  slides: z.number().int().min(2).max(10).optional(),
}).strict();

const creditCost = (format: typeof formats[number], slides = 1) =>
  format === "caption" ? 2 : format === "carousel" ? slides * 5 : 5;

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_INPUT", "Revise os dados da geração.");

    const workspaceResult = await client.rpc("get_my_workspace");
    if (workspaceResult.error || !workspaceResult.data?.organization?.id)
      throw workspaceResult.error ?? new Error("WORKSPACE_NOT_FOUND");
    const promptResult = await client
      .from("prompt_templates")
      .select("system_prompt,user_prompt,packages")
      .eq("task", "visual-copy")
      .in("format", [parsed.data.format, "all"])
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (promptResult.error) throw promptResult.error;
    const selectedTemplate = await selectVisualTemplate(
      createAdminClient(),
      parsed.data.format,
      promptResult.data?.packages ?? [],
    );

    const generated = await generateContentDraftsWithOpenAI({
      userId: user.id,
      ...parsed.data,
      slides: parsed.data.format === "carousel" ? parsed.data.slides ?? 5 : 1,
      brand: workspaceResult.data.brand ?? null,
      template: selectedTemplate,
      promptTemplate: promptResult.data
        ? {
            systemPrompt: promptResult.data.system_prompt,
            userPrompt: promptResult.data.user_prompt,
          }
        : null,
    });
    const slides = parsed.data.format === "carousel" ? parsed.data.slides ?? 5 : 1;
    return json(request, {
      drafts: generated.drafts.map((draft, index) => ({
        id: crypto.randomUUID(),
        title: draft.title,
        topic: parsed.data.topic,
        format: parsed.data.format,
        caption: draft.caption,
        hashtags: draft.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`),
        cta: draft.cta,
        slides,
        slideTexts: draft.slideTexts,
        reelScript: parsed.data.format === "reel" || parsed.data.format === "video"
          ? { hook: draft.reelHook, duration: 24, scenes: draft.reelScenes }
          : undefined,
        creditCost: creditCost(parsed.data.format, slides),
        variation: index + 1,
      })),
      model: generated.model,
      traceId,
    });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
