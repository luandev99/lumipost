import { appUrl, createAdminClient, metaConfig } from "../_shared/config.ts";
import { sha256 } from "../_shared/crypto.ts";
import { getMetaProfile, getRecentMetaMedia } from "../_shared/meta.ts";

const redirect = (path: string, result: "success" | "error", code?: string) => {
  const safePath = ["/social-accounts", "/brand"].includes(path)
    ? path
    : "/social-accounts";
  const destination = new URL(safePath, appUrl());
  destination.searchParams.set("instagram", result);
  if (code) destination.searchParams.set("code", code);
  return Response.redirect(destination.toString(), 303);
};

Deno.serve(async (request) => {
  if (request.method !== "GET")
    return new Response("Method not allowed", { status: 405 });
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  if (!code || !state || state.length > 256)
    return redirect("/social-accounts", "error", "oauth_invalid");

  const admin = createAdminClient();
  let returnPath = "/social-accounts";
  let accountId: string | undefined;
  let oauthOrgId: string | undefined;
  let oauthUserId: string | undefined;
  try {
    const stateHash = await sha256(state);
    const now = new Date().toISOString();
    const { data: oauthState, error: stateError } = await admin
      .from("meta_oauth_states")
      .update({ consumed_at: now })
      .eq("state_sha256", stateHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("organization_id,user_id,return_path")
      .maybeSingle();
    if (stateError || !oauthState)
      return redirect("/social-accounts", "error", "oauth_expired");
    returnPath = oauthState.return_path;
    oauthOrgId = oauthState.organization_id;
    oauthUserId = oauthState.user_id;

    const config = metaConfig();
    const shortExchangeForm = new FormData();
    shortExchangeForm.set("client_id", config.appId);
    shortExchangeForm.set("client_secret", config.appSecret);
    shortExchangeForm.set("grant_type", "authorization_code");
    shortExchangeForm.set("redirect_uri", config.redirectUri);
    shortExchangeForm.set("code", code);
    const shortResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: { Accept: "application/json" },
        body: shortExchangeForm,
      },
    );
    const shortPayload = (await shortResponse.json().catch(() => ({}))) as {
      access_token?: string;
      user_id?: string;
      error_type?: string;
      error_message?: string;
      code?: number;
    };
    if (!shortResponse.ok || !shortPayload.access_token)
      throw new Error(
        `META_CODE_EXCHANGE_FAILED:${shortResponse.status}:${shortPayload.error_type ?? "UNKNOWN"}:${(shortPayload.error_message ?? "").slice(0, 200)}`,
      );

    const exchangeUrl = new URL("https://graph.instagram.com/access_token");
    exchangeUrl.searchParams.set("grant_type", "ig_exchange_token");
    exchangeUrl.searchParams.set("client_secret", config.appSecret);
    exchangeUrl.searchParams.set("access_token", shortPayload.access_token);
    const longResponse = await fetch(exchangeUrl, {
      headers: { Accept: "application/json" },
    });
    const longPayload = (await longResponse.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error_type?: string;
      error_message?: string;
    };
    if (!longResponse.ok || !longPayload.access_token)
      throw new Error(
        `META_TOKEN_EXCHANGE_FAILED:${longResponse.status}:${longPayload.error_type ?? "UNKNOWN"}:${(longPayload.error_message ?? "").slice(0, 200)}`,
      );

    const profile = await getMetaProfile(longPayload.access_token);
    const externalAccountId =
      profile.user_id ?? profile.id ?? shortPayload.user_id;
    if (!externalAccountId || !profile.username)
      throw new Error("META_PROFILE_INVALID");

    const { data: existing, error: existingError } = await admin
      .from("social_accounts")
      .select("id,organization_id")
      .eq("network", "instagram")
      .eq("external_account_id", externalAccountId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.organization_id !== oauthState.organization_id)
      throw new Error("META_ACCOUNT_ALREADY_CONNECTED");

    const expiresAt = longPayload.expires_in
      ? new Date(Date.now() + longPayload.expires_in * 1000).toISOString()
      : null;
    const accountPayload = {
      organization_id: oauthState.organization_id,
      user_id: oauthState.user_id,
      network: "instagram",
      provider: "meta",
      external_account_id: externalAccountId,
      handle: profile.username,
      display_name: profile.name || profile.username,
      avatar_url: profile.profile_picture_url ?? null,
      account_type: profile.account_type ?? null,
      biography: profile.biography ?? null,
      website: profile.website ?? null,
      followers_count: profile.followers_count ?? null,
      media_count: profile.media_count ?? null,
      status: "active",
      token_expires_at: expiresAt,
      scopes: [
        "instagram_business_basic",
        "instagram_business_content_publish",
      ],
      last_synced_at: now,
    };
    const writeResult = existing
      ? await admin
          .from("social_accounts")
          .update(accountPayload)
          .eq("id", existing.id)
          .select("id")
          .single()
      : await admin
          .from("social_accounts")
          .insert(accountPayload)
          .select("id")
          .single();
    if (writeResult.error || !writeResult.data)
      throw writeResult.error ?? new Error("SOCIAL_ACCOUNT_WRITE_FAILED");
    accountId = writeResult.data.id;

    const { error: tokenError } = await admin.rpc(
      "store_social_token_service",
      {
        target_account: accountId,
        access_token: longPayload.access_token,
        expires_at: expiresAt,
      },
    );
    if (tokenError) throw tokenError;

    const recentMedia = await getRecentMetaMedia(
      externalAccountId,
      longPayload.access_token,
    ).catch(() => []);
    await admin.from("social_profile_snapshots").insert({
      organization_id: oauthState.organization_id,
      social_account_id: accountId,
      profile,
      recent_media: recentMedia,
    });
    await admin
      .from("brands")
      .update({
        instagram_handle: profile.username,
        instagram_connected: true,
      })
      .eq("organization_id", oauthState.organization_id)
      .eq("is_default", true);
    await admin.from("audit_logs").insert({
      organization_id: oauthState.organization_id,
      actor_user_id: oauthState.user_id,
      action: "instagram_connected",
      entity_type: "social_account",
      entity_id: accountId,
      after_data: {
        handle: profile.username,
        account_type: profile.account_type,
        scopes: accountPayload.scopes,
      },
    });
    return redirect(returnPath, "success");
  } catch (error) {
    if (accountId)
      await admin
        .from("social_accounts")
        .update({ status: "error" })
        .eq("id", accountId);
    const internalCode =
      error instanceof Error ? error.message : "META_OAUTH_FAILED";
    console.error(
      JSON.stringify({ level: "error", code: internalCode.slice(0, 500) }),
    );
    if (oauthOrgId)
      await admin.from("audit_logs").insert({
        organization_id: oauthOrgId,
        actor_user_id: oauthUserId ?? null,
        action: "instagram_connect_failed",
        entity_type: "social_account",
        entity_id: accountId ?? null,
        after_data: { reason: internalCode.slice(0, 500) },
      });
    return redirect(
      returnPath,
      "error",
      internalCode === "META_ACCOUNT_ALREADY_CONNECTED"
        ? "already_connected"
        : "connection_failed",
    );
  }
});
