import { z } from "npm:zod@3.24.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";
import {
  buildPaletteInstruction,
  describeDesignSystemWithOpenAI,
  describeReferenceImageWithOpenAI,
  editImageWithOpenAI,
  generateContentDraftsWithOpenAI,
  generateImageWithOpenAI,
  type OpenAiUsage,
} from "./openai.ts";
import { costMillicents } from "./ai-pricing.ts";
import { selectVisualTemplate } from "./template-selection.ts";
import { submitVideoJob } from "./higgsfield.ts";

const formats = ["post", "carousel", "story", "reel", "video", "caption"] as const;
const sceneSchema = z.object({
  title: z.string().trim().min(2).max(120),
  narration: z.string().trim().min(2).max(600),
}).strict();

export const generateAiContentInputSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(200),
  title: z.string().trim().min(3).max(180).optional(),
  topic: z.string().trim().min(3).max(500),
  objective: z.string().trim().min(3).max(300).default("Gerar engajamento"),
  style: z.string().trim().min(2).max(120).default("Profissional"),
  instructions: z.string().trim().max(1500).optional(),
  format: z.enum(formats),
  slides: z.number().int().min(2).max(10).optional(),
  caption: z.string().trim().max(2200).optional(),
  hashtags: z.array(z.string().trim().min(2).max(80)).max(12).optional(),
  cta: z.string().trim().max(240).optional(),
  slideTexts: z.array(z.string().trim().min(2).max(280)).max(10).optional(),
  reelScript: z.object({
    hook: z.string().trim().max(240),
    duration: z.number().int().min(5).max(180),
    scenes: z.array(sceneSchema).max(12),
  }).strict().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().trim().min(3).max(80).default("America/Sao_Paulo"),
  socialAccountId: z.string().uuid().optional(),
  referenceImagePath: z.string().trim().min(3).max(400).optional(),
  referenceMode: z.enum(["base", "context"]).optional(),
  useBrandLogo: z.boolean().optional(),
}).strict();

export type GenerateAiContentInput = z.infer<typeof generateAiContentInputSchema>;

export type GenerateAiContentResult = {
  contentId: string;
  jobId?: string;
  generationId: string;
  creditBalance: {
    organization_id: unknown;
    balance: number;
    reserved: number;
    available: number;
    version: number;
  };
  chargedCredits: number;
  idempotent?: boolean;
};

const costFor = (format: typeof formats[number], slides: number) =>
  format === "caption" ? 2 : format === "carousel" ? slides * 5 : 5;

const normalizedWallet = (row: Record<string, unknown>) => ({
  organization_id: row.organization_id,
  balance: Number(row.balance ?? 0),
  reserved: Number(row.reserved ?? 0),
  available: Number(row.balance ?? 0) - Number(row.reserved ?? 0),
  version: Number(row.version ?? 0),
});

// Núcleo de geração de conteúdo por IA, sem dependência de sessão de
// usuário: quem chama já resolveu organizationId/userId (do JWT autenticado
// no handler HTTP, ou de weekly_plans no worker em background). Todas as
// leituras usam o client admin — organizationId já é confiável em ambos os
// casos, não há RLS a aplicar aqui.
export const generateAiContent = async (
  admin: SupabaseClient,
  params: { organizationId: string; userId: string; input: GenerateAiContentInput },
): Promise<GenerateAiContentResult> => {
  const { organizationId, userId, input } = params;
  const requestKey = input.idempotencyKey;
  const slides = input.format === "carousel" ? input.slides ?? 5 : 1;
  const creditCost = costFor(input.format, slides);

  let generationId: string | undefined;
  let charged = false;
  let createdContentId: string | undefined;
  let createdJobId: string | undefined;
  const uploadedPaths: string[] = [];

  try {
    if (input.scheduledAt && ["reel", "video"].includes(input.format))
      throw new HttpError(
        422,
        "VIDEO_UPLOAD_REQUIRED",
        "Para agendar Reel ou vídeo, envie um MP4 real. A Lumipost não publica vídeo demonstrativo.",
      );
    if (
      input.scheduledAt &&
      new Date(input.scheduledAt).getTime() < Date.now() + 60 * 60 * 1000
    )
      throw new HttpError(
        422,
        "SCHEDULE_MUST_BE_AT_LEAST_1H_AHEAD",
        "Escolha um horário com pelo menos 1 hora de antecedência.",
      );

    // Resolve a conta ANTES de debitar créditos ou chamar a OpenAI: falhar
    // rápido aqui evita gastar geração de verdade com uma conta inválida.
    // Publicações simultâneas na mesma conta são permitidas de propósito —
    // sem trava de horário único.
    let socialAccountId: string | null = null;
    if (input.scheduledAt) {
      if (!input.socialAccountId)
        throw new HttpError(422, "SOCIAL_ACCOUNT_REQUIRED", "Conecte e selecione uma conta do Instagram.");
      const { data: social, error: socialError } = await admin
        .from("social_accounts")
        .select("id")
        .eq("id", input.socialAccountId)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle();
      if (socialError) throw socialError;
      if (!social)
        throw new HttpError(404, "SOCIAL_ACCOUNT_NOT_FOUND", "Conta social não encontrada.");
      socialAccountId = social.id;
    }

    const brandResult = await admin
      .from("brands")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .maybeSingle();
    if (brandResult.error) throw brandResult.error;
    const brand = brandResult.data ?? null;

    const { data: previous, error: previousError } = await admin
      .from("content_generation_requests")
      .select("id,status,content_id,started_at")
      .eq("organization_id", organizationId)
      .eq("request_key", requestKey)
      .maybeSingle();
    if (previousError) throw previousError;
    if (previous?.status === "completed" && previous.content_id) {
      const { data: wallet, error: walletError } = await admin
        .from("credit_wallets")
        .select("*")
        .eq("organization_id", organizationId)
        .single();
      if (walletError) throw walletError;
      return {
        contentId: previous.content_id,
        generationId: previous.id,
        creditBalance: normalizedWallet(wallet),
        chargedCredits: 0,
        idempotent: true,
      };
    }
    // "processing" só bloqueia retry enquanto for recente. Se a Edge
    // Function anterior morreu no meio (timeout da plataforma, crash), a
    // linha fica presa em "processing" pra sempre — sem isso, o request_key
    // ficava permanentemente inutilizável e o item nunca mais gerava.
    const isStaleProcessing =
      previous?.status === "processing" &&
      new Date(previous.started_at).getTime() < Date.now() - 5 * 60 * 1000;
    if (previous?.status === "processing" && !isStaleProcessing)
      throw new HttpError(409, "GENERATION_IN_PROGRESS", "Esta geração ainda está em andamento.");

    const generationPayload = {
      organization_id: organizationId,
      user_id: userId,
      request_key: requestKey,
      format: input.format,
      status: "processing",
      credit_cost: creditCost,
      input: {
        topic: input.topic,
        objective: input.objective,
        style: input.style,
        slides,
        scheduledAt: input.scheduledAt ?? null,
      },
      content_id: null,
      error_code: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    };
    const generationQuery = previous?.status === "failed" || isStaleProcessing
      ? admin
        .from("content_generation_requests")
        .update(generationPayload)
        .eq("id", previous.id)
      : admin.from("content_generation_requests").insert(generationPayload);
    const { data: generation, error: generationError } = await generationQuery
      .select("id")
      .single();
    if (generationError || !generation)
      throw generationError ?? new Error("GENERATION_CREATE_FAILED");
    generationId = generation.id;

    const { data: debitedWallet, error: debitError } = await admin.rpc(
      "consume_credits_service",
      {
        target_org: organizationId,
        amount_to_consume: creditCost,
        idem_key: `ai-generation:${requestKey}`.slice(0, 200),
        ref_type: "ai_content_generation",
        ref_id: generationId,
        actor_id: userId,
      },
    );
    if (debitError) throw debitError;
    charged = true;

    let title = input.title;
    let caption = input.caption;
    let hashtags = input.hashtags;
    let cta = input.cta;
    let slideTexts = input.slideTexts;
    let reelScript = input.reelScript;
    let textModel: string | undefined;
    let selectedTemplate: Awaited<ReturnType<typeof selectVisualTemplate>>;
    // Somatório de tokens de todas as chamadas OpenAI desta geração (copy +
    // cada imagem), gravado no fim para o painel de custo do admin. O custo
    // é acumulado por chamada, não no total: texto e imagem rodam em modelos
    // com preços muito diferentes e somar os tokens antes de precificar daria
    // um número errado.
    const usageTotals = { input: 0, output: 0, total: 0, calls: 0 };
    let usageCostMillicents = 0;
    const addUsage = (usage: OpenAiUsage, model: string) => {
      usageTotals.input += usage.inputTokens;
      usageTotals.output += usage.outputTokens;
      usageTotals.total += usage.totalTokens;
      usageTotals.calls += 1;
      usageCostMillicents += costMillicents({
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
    };

    if (!title || !caption || !hashtags?.length || !cta ||
      (input.format === "carousel" && slideTexts?.length !== slides)) {
      const promptResult = await admin
        .from("prompt_templates")
        .select("system_prompt,user_prompt,packages")
        .eq("task", "visual-copy")
        .in("format", [input.format, "all"])
        .eq("status", "active")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (promptResult.error) throw promptResult.error;
      selectedTemplate = await selectVisualTemplate(
        admin,
        input.format,
        promptResult.data?.packages ?? [],
      );
      const generated = await generateContentDraftsWithOpenAI({
        userId,
        objective: input.objective,
        topic: input.topic,
        format: input.format,
        style: input.style,
        instructions: input.instructions,
        variations: 1,
        slides,
        brand,
        template: selectedTemplate,
        promptTemplate: promptResult.data
          ? {
              systemPrompt: promptResult.data.system_prompt,
              userPrompt: promptResult.data.user_prompt,
            }
          : null,
      });
      const draft = generated.drafts[0];
      textModel = generated.model;
      addUsage(generated.usage, generated.model);
      title ||= draft.title;
      caption ||= draft.caption;
      hashtags = hashtags?.length ? hashtags : draft.hashtags;
      cta ||= draft.cta;
      slideTexts = input.format === "carousel" ? draft.slideTexts.slice(0, slides) : undefined;
      if (input.format === "reel" || input.format === "video") {
        reelScript ||= {
          hook: draft.reelHook,
          duration: 24,
          scenes: draft.reelScenes,
        };
      }
    }
    if (input.format === "carousel" && slideTexts?.length !== slides)
      throw new Error("OPENAI_INVALID_CAROUSEL_SLIDES");

    // Foto de referência (opcional): "context" descreve a imagem uma única
    // vez e injeta a descrição no prompt de cada slide; "base" reusa os
    // bytes originais como ponto de partida (edição) em cada imagem gerada.
    let referenceDescription: string | undefined;
    let referenceBytes: Uint8Array | undefined;
    let referencePurpose: "reference" | "logo" = "reference";
    if (input.referenceImagePath) {
      const { data: signedRef, error: signedRefError } = await admin.storage
        .from("content-uploads")
        .createSignedUrl(input.referenceImagePath, 60 * 15);
      if (signedRefError || !signedRef?.signedUrl)
        throw signedRefError ?? new Error("REFERENCE_IMAGE_NOT_FOUND");
      if (input.referenceMode === "base") {
        const refResponse = await fetch(signedRef.signedUrl);
        if (!refResponse.ok) throw new Error("REFERENCE_IMAGE_FETCH_FAILED");
        referenceBytes = new Uint8Array(await refResponse.arrayBuffer());
      } else {
        referenceDescription = await describeReferenceImageWithOpenAI(
          signedRef.signedUrl,
          userId,
        );
      }
    } else if (input.useBrandLogo && brand?.logo_path) {
      const { data: signedLogo, error: signedLogoError } = await admin.storage
        .from("brand-assets")
        .createSignedUrl(brand.logo_path as string, 60 * 15);
      if (signedLogoError || !signedLogo?.signedUrl)
        throw signedLogoError ?? new Error("BRAND_LOGO_NOT_FOUND");
      const logoResponse = await fetch(signedLogo.signedUrl);
      if (!logoResponse.ok) throw new Error("BRAND_LOGO_FETCH_FAILED");
      referenceBytes = new Uint8Array(await logoResponse.arrayBuffer());
      referencePurpose = "logo";
    }

    let imageModel: string | undefined;
    // Continuidade de design do carrossel: em vez de editar os pixels do
    // slide anterior (o que fazia o modelo preservar quase o fundo inteiro e
    // parecer a MESMA foto repetida), o slide 1 é descrito só no seu sistema
    // gráfico — paleta, tipografia, painéis, tratamento de fundo — e essa
    // descrição guia a geração dos slides seguintes do zero (texto-para-
    // imagem), cada um com uma cena/foto nova mas a mesma linguagem visual.
    let designSystemDescription: string | undefined;
    // Sem isso, as cores da marca só existiam soltas dentro do JSON do
    // prompt (brand.primary_color/secondary_color) como dado de contexto, e
    // o modelo de imagem preferia seu próprio viés estético padrão (gradiente
    // roxo/violeta é um dos mais comuns) em vez de respeitar a paleta real.
    const paletteInstruction = buildPaletteInstruction(
      brand?.primary_color,
      brand?.secondary_color,
    );
    if (input.format !== "caption") {
      const imageSubjects = input.format === "carousel"
        ? slideTexts ?? []
        : [title ?? input.topic];
      const textOverlayFormats = new Set(["post", "story", "carousel"]);
      for (let index = 0; index < imageSubjects.length; index += 1) {
        const imagePrompt = JSON.stringify({
          brand: brand ?? {},
          format: input.format,
          topic: input.topic,
          title,
          visualSubject: imageSubjects[index],
          slide: index + 1,
          slides: imageSubjects.length,
          style: input.style,
          selectedTemplate,
          referenceDescription,
        });
        // A foto de referência do usuário (modo "base"), quando existe, é a
        // base visual de TODOS os slides — é o produto/pessoa real dele, não
        // um sistema de design a copiar. Sem ela, cada slide é gerado do
        // zero; do segundo em diante, com a descrição do sistema gráfico do
        // primeiro slide para manter a mesma identidade.
        const textOverlay = textOverlayFormats.has(input.format)
          ? imageSubjects[index]
          : undefined;
        const vertical = ["story", "reel", "video", "carousel"].includes(input.format);
        const generatedImage = referenceBytes
          ? await editImageWithOpenAI({
              userId,
              imageBytes: referenceBytes,
              vertical,
              textOverlay,
              prompt: imagePrompt,
              purpose: referencePurpose,
              paletteInstruction,
            })
          : await generateImageWithOpenAI({
              userId,
              vertical,
              textOverlay,
              prompt: imagePrompt,
              designSystemDescription:
                input.format === "carousel" && index > 0
                  ? designSystemDescription
                  : undefined,
              paletteInstruction,
            });
        imageModel = generatedImage.model;
        addUsage(generatedImage.usage, generatedImage.model);
        if (input.format === "carousel" && index === 0 && !referenceBytes) {
          designSystemDescription = await describeDesignSystemWithOpenAI(
            generatedImage.bytes,
            userId,
          );
        }
        const objectPath = `${organizationId}/${userId}/ai/${generationId}/${String(index + 1).padStart(2, "0")}.png`;
        // upsert: true — um retry após reclaim de "processing" travado reusa
        // o mesmo generationId (mesmo path). Sem isso, uma imagem já
        // enviada por uma tentativa anterior abandonada faz o retry inteiro
        // falhar com "resource already exists" antes mesmo de tentar gerar
        // de novo.
        const upload = await admin.storage.from("generated-media").upload(
          objectPath,
          generatedImage.bytes,
          { contentType: "image/png", cacheControl: "31536000", upsert: true },
        );
        if (upload.error) throw upload.error;
        uploadedPaths.push(objectPath);
      }
    }

    selectedTemplate ??= await selectVisualTemplate(admin, input.format);

    const { data: content, error: contentError } = await admin
      .from("contents")
      .insert({
        organization_id: organizationId,
        brand_id: brand?.id ?? null,
        user_id: userId,
        title: title ?? input.topic,
        format: input.format,
        source: "ai",
        status: input.scheduledAt ? "scheduled" : "draft",
        topic: input.topic,
        caption: caption ?? "",
        hashtags: (hashtags ?? []).map((tag) => tag.startsWith("#") ? tag : `#${tag}`),
        cta: cta ?? "",
        scheduled_at: input.scheduledAt ?? null,
        media_paths: uploadedPaths.map((path) => `generated-media/${path}`),
        slide_texts: slideTexts ?? null,
        reel_script: reelScript ?? null,
        template_path: selectedTemplate?.specPath ?? null,
        social_account_ids: socialAccountId ? [socialAccountId] : [],
        tags: ["IA"],
      })
      .select("id")
      .single();
    if (contentError || !content)
      throw contentError ?? new Error("CONTENT_CREATE_FAILED");
    createdContentId = content.id;

    // Vídeo real via Higgsfield: submit é rápido (~1s), a geração em si
    // (~45s-alguns min) roda em background, o worker de polling é quem
    // baixa o resultado. Falha aqui não derruba o resto — capa e roteiro
    // já são um rascunho útil sozinhos.
    if (["reel", "video"].includes(input.format) && uploadedPaths.length && reelScript) {
      try {
        const { data: signed, error: signError } = await admin.storage
          .from("generated-media")
          .createSignedUrl(uploadedPaths[0], 60 * 30);
        if (signError || !signed?.signedUrl)
          throw signError ?? new Error("COVER_SIGN_FAILED");
        const prompt =
          reelScript.hook || reelScript.scenes[0]?.narration || title || input.topic;
        const video = await submitVideoJob({
          imageUrl: signed.signedUrl,
          prompt,
        });
        const { error: videoJobError } = await admin
          .from("video_generation_jobs")
          .insert({
            organization_id: organizationId,
            content_id: content.id,
            provider_request_id: video.providerRequestId,
          });
        if (videoJobError) throw videoJobError;
        await admin
          .from("contents")
          .update({ status: "generating" })
          .eq("id", content.id);
      } catch (videoError) {
        console.error(
          JSON.stringify({
            level: "error",
            code: `HIGGSFIELD_SUBMIT_ERROR:${videoError instanceof Error ? videoError.message.slice(0, 200) : "UNKNOWN"}`,
          }),
        );
      }
    }

    let jobId: string | undefined;
    if (input.scheduledAt && socialAccountId) {
      const { data: job, error: jobError } = await admin
        .from("publishing_jobs")
        .insert({
          organization_id: organizationId,
          content_id: content.id,
          social_account_id: socialAccountId,
          scheduled_at: input.scheduledAt,
          timezone: input.timezone,
          idempotency_key: `ai-schedule:${requestKey}`.slice(0, 200),
        })
        .select("id")
        .single();
      if (jobError) throw jobError;
      if (!job) throw new Error("JOB_CREATE_FAILED");
      jobId = job.id;
      createdJobId = job.id;
    }

    const { error: completeError } = await admin
      .from("content_generation_requests")
      .update({
        status: "completed",
        content_id: content.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId);
    if (completeError) throw completeError;

    // Custo real desta geração. Falha aqui não derruba o conteúdo já criado:
    // é telemetria de operação, não parte do que o cliente pediu.
    if (usageTotals.calls > 0) {
      const { error: usageError } = await admin.from("ai_usage_events").insert({
        organization_id: organizationId,
        user_id: userId,
        generation_id: generationId,
        content_id: content.id,
        format: input.format,
        text_model: textModel ?? null,
        image_model: imageModel ?? null,
        api_calls: usageTotals.calls,
        input_tokens: usageTotals.input,
        output_tokens: usageTotals.output,
        total_tokens: usageTotals.total,
        cost_millicents: usageCostMillicents,
        credits_charged: creditCost,
      });
      if (usageError)
        console.error(
          JSON.stringify({
            level: "warn",
            code: "AI_USAGE_TRACK_FAILED",
            message: usageError.message?.slice(0, 200),
          }),
        );
    }

    await admin.from("audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: userId,
      action: "ai_content_generated",
      entity_type: "content",
      entity_id: content.id,
      after_data: {
        generation_id: generationId,
        format: input.format,
        charged_credits: creditCost,
        text_model: textModel,
        image_model: imageModel,
        scheduled: Boolean(input.scheduledAt),
      },
    });

    const walletRow = Array.isArray(debitedWallet) ? debitedWallet[0] : debitedWallet;
    return {
      contentId: content.id,
      jobId,
      generationId,
      creditBalance: normalizedWallet(walletRow as Record<string, unknown>),
      chargedCredits: creditCost,
    };
  } catch (error) {
    if (createdJobId)
      await admin.from("publishing_jobs").delete().eq("id", createdJobId);
    if (createdContentId)
      await admin.from("contents").delete().eq("id", createdContentId);
    if (uploadedPaths.length)
      await admin.storage.from("generated-media").remove(uploadedPaths);
    if (charged && generationId) {
      await admin.rpc("grant_credits_service", {
        target_org: organizationId,
        amount_to_grant: creditCost,
        idem_key: `ai-refund:${requestKey}`.slice(0, 200),
        ref_type: "ai_generation_refund",
        ref_id: generationId,
        actor_id: userId,
      });
    }
    if (generationId) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
      await admin.from("content_generation_requests").update({
        status: "failed",
        error_code: message.slice(0, 300),
        completed_at: new Date().toISOString(),
      }).eq("id", generationId);
    }
    throw error;
  }
};
