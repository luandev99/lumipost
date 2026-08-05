import { z } from "npm:zod@3.24.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getMetaProfile, getRecentMetaMedia } from "./meta.ts";
import {
  analyzeBrandWithOpenAI,
  type BrandIdentityProposal,
} from "./openai.ts";

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

// Extraído de brand-analyze-instagram/index.ts para ser reaproveitado tanto
// pelo botão manual "Analisar Instagram" quanto pelo gatilho automático no
// callback de OAuth do Instagram — parametrizado em vez de assumir uma
// request HTTP autenticada, já que quem chama já validou a propriedade da
// marca/conta antes de invocar isto.
export const runBrandAnalysis = async (
  admin: SupabaseClient,
  input: {
    brandId: string;
    organizationId: string;
    socialAccountId: string;
    requestedBy: string;
    applyAutomatically: boolean;
  },
): Promise<{
  jobId: string;
  status: "review" | "applied";
  proposal: BrandIdentityProposal;
}> => {
  let jobId: string | undefined;
  try {
    const { data: job, error: jobError } = await admin
      .from("brand_analysis_jobs")
      .insert({
        organization_id: input.organizationId,
        brand_id: input.brandId,
        social_account_id: input.socialAccountId,
        requested_by: input.requestedBy,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (jobError || !job)
      throw jobError ?? new Error("ANALYSIS_JOB_CREATE_FAILED");
    jobId = job.id;

    const { data: account, error: accountError } = await admin
      .from("social_accounts")
      .select("external_account_id")
      .eq("id", input.socialAccountId)
      .single();
    if (accountError || !account)
      throw accountError ?? new Error("SOCIAL_ACCOUNT_NOT_FOUND");

    const { data: token, error: tokenError } = await admin.rpc(
      "read_social_token_service",
      { target_account: input.socialAccountId },
    );
    if (tokenError || typeof token !== "string")
      throw tokenError ?? new Error("SOCIAL_TOKEN_NOT_FOUND");

    const profile = await getMetaProfile(token);
    const media = await getRecentMetaMedia(
      account.external_account_id,
      token,
    );
    const { data: snapshot, error: snapshotError } = await admin
      .from("social_profile_snapshots")
      .insert({
        organization_id: input.organizationId,
        social_account_id: input.socialAccountId,
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

    const analyzed = await analyzeBrandWithOpenAI(
      profile,
      media,
      input.requestedBy,
    );
    const proposal = proposalSchema.parse(analyzed.proposal);
    const completedAt = new Date().toISOString();
    let status: "review" | "applied" = "review";

    if (input.applyAutomatically) {
      let logoPath: string | undefined;
      if (profile.profile_picture_url) {
        try {
          const avatarResponse = await fetch(profile.profile_picture_url);
          if (avatarResponse.ok) {
            const contentType =
              avatarResponse.headers.get("content-type") ?? "image/jpeg";
            const extension = contentType.includes("png") ? "png" : "jpg";
            const path = `${input.organizationId}/logo/instagram-avatar.${extension}`;
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
        .eq("id", input.brandId)
        .eq("organization_id", input.organizationId);
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
      organization_id: input.organizationId,
      actor_user_id: input.requestedBy,
      action: input.applyAutomatically
        ? "brand_identity_analyzed_and_applied"
        : "brand_identity_analyzed",
      entity_type: "brand",
      entity_id: input.brandId,
      after_data: {
        analysis_job_id: jobId,
        confidence: proposal.confidence,
        model: analyzed.model,
      },
    });

    return { jobId: job.id, status, proposal };
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
    throw error;
  }
};
