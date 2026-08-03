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
import { getMetaProfile, getRecentMetaMedia } from "../_shared/meta.ts";
import { analyzeBrandWithOpenAI } from "../_shared/openai.ts";

const inputSchema = z
  .object({
    brandId: z.string().uuid(),
    socialAccountId: z.string().uuid(),
    applyAutomatically: z.boolean().default(true),
  })
  .strict();

const proposalSchema = z
  .object({
    description: z.string().min(20).max(600),
    industry: z.string().min(2).max(100),
    specialty: z.string().min(2).max(160),
    audience: z.string().min(5).max(300),
    personality: z.array(z.string().min(2).max(60)).min(1).max(5),
    tone: z.array(z.string().min(2).max(60)).min(1).max(5),
    visualStyle: z.string().min(2).max(100),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    headingFont: z.string().min(2).max(80),
    bodyFont: z.string().min(2).max(80),
    evidence: z.array(z.string().min(5).max(240)).min(1).max(8),
    confidence: z.number().min(0).max(1),
  })
  .strict();

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  let jobId: string | undefined;
  const admin = createAdminClient();

  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(
        422,
        "INVALID_INPUT",
        "Selecione a marca e a conta do Instagram.",
      );

    const [brandResult, accountResult] = await Promise.all([
      client
        .from("brands")
        .select("id,organization_id")
        .eq("id", parsed.data.brandId)
        .maybeSingle(),
      client
        .from("social_accounts")
        .select("id,organization_id,external_account_id,status")
        .eq("id", parsed.data.socialAccountId)
        .maybeSingle(),
    ]);
    if (brandResult.error) throw brandResult.error;
    if (accountResult.error) throw accountResult.error;
    const brand = brandResult.data;
    const account = accountResult.data;
    if (
      !brand ||
      !account ||
      brand.organization_id !== account.organization_id ||
      account.status !== "active"
    ) {
      throw new HttpError(
        404,
        "SOCIAL_ACCOUNT_NOT_FOUND",
        "Conta do Instagram não encontrada ou expirada.",
      );
    }

    const { data: job, error: jobError } = await admin
      .from("brand_analysis_jobs")
      .insert({
        organization_id: brand.organization_id,
        brand_id: brand.id,
        social_account_id: account.id,
        requested_by: user.id,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (jobError || !job)
      throw jobError ?? new Error("ANALYSIS_JOB_CREATE_FAILED");
    jobId = job.id;

    const { data: token, error: tokenError } = await admin.rpc(
      "read_social_token_service",
      {
        target_account: account.id,
      },
    );
    if (tokenError || typeof token !== "string")
      throw tokenError ?? new Error("SOCIAL_TOKEN_NOT_FOUND");

    const profile = await getMetaProfile(token);
    const media = await getRecentMetaMedia(account.external_account_id, token);
    const { data: snapshot, error: snapshotError } = await admin
      .from("social_profile_snapshots")
      .insert({
        organization_id: brand.organization_id,
        social_account_id: account.id,
        profile,
        recent_media: media,
      })
      .select("id")
      .single();
    if (snapshotError || !snapshot)
      throw snapshotError ?? new Error("SNAPSHOT_CREATE_FAILED");
    await admin
      .from("brand_analysis_jobs")
      .update({ input_snapshot_id: snapshot.id })
      .eq("id", jobId);

    const analyzed = await analyzeBrandWithOpenAI(profile, media, user.id);
    const proposal = proposalSchema.parse(analyzed.proposal);
    const completedAt = new Date().toISOString();
    let status: "review" | "applied" = "review";

    if (parsed.data.applyAutomatically) {
      let logoPath: string | undefined;
      if (profile.profile_picture_url) {
        try {
          const avatarResponse = await fetch(profile.profile_picture_url);
          if (avatarResponse.ok) {
            const contentType =
              avatarResponse.headers.get("content-type") ?? "image/jpeg";
            const extension = contentType.includes("png") ? "png" : "jpg";
            const path = `${brand.organization_id}/logo/instagram-avatar.${extension}`;
            const bytes = new Uint8Array(await avatarResponse.arrayBuffer());
            const { error: uploadError } = await admin.storage
              .from("brand-assets")
              .upload(path, bytes, { contentType, upsert: true });
            if (!uploadError) logoPath = path;
          }
        } catch {
          // Best-effort: a logo não é essencial para aplicar a identidade.
        }
      }

      const { error: brandError } = await admin
        .from("brands")
        .update({
          description: proposal.description,
          industry: proposal.industry,
          specialty: proposal.specialty,
          audience: proposal.audience,
          personality: proposal.personality,
          tone: proposal.tone,
          visual_style: proposal.visualStyle,
          primary_color: proposal.primaryColor.toUpperCase(),
          secondary_color: proposal.secondaryColor.toUpperCase(),
          heading_font: proposal.headingFont,
          body_font: proposal.bodyFont,
          instagram_handle: profile.username,
          instagram_connected: true,
          ...(logoPath ? { logo_path: logoPath } : {}),
        })
        .eq("id", brand.id)
        .eq("organization_id", brand.organization_id);
      if (brandError) throw brandError;
      status = "applied";
    }

    const { error: completeError } = await admin
      .from("brand_analysis_jobs")
      .update({
        status,
        result: proposal,
        model: analyzed.model,
        completed_at: completedAt,
      })
      .eq("id", jobId);
    if (completeError) throw completeError;
    await admin.from("audit_logs").insert({
      organization_id: brand.organization_id,
      actor_user_id: user.id,
      action: parsed.data.applyAutomatically
        ? "brand_identity_analyzed_and_applied"
        : "brand_identity_analyzed",
      entity_type: "brand",
      entity_id: brand.id,
      after_data: {
        analysis_job_id: jobId,
        confidence: proposal.confidence,
        model: analyzed.model,
      },
    });

    return json(request, { jobId, status, proposal, traceId });
  } catch (error) {
    if (jobId) {
      const code =
        error instanceof Error
          ? error.message.slice(0, 120)
          : "ANALYSIS_FAILED";
      await admin
        .from("brand_analysis_jobs")
        .update({
          status: "failed",
          error_code: code,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }
    return errorResponse(request, error, traceId);
  }
});
