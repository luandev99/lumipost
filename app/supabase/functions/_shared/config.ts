import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`MISSING_SERVER_CONFIG:${name}`);
  return value;
};

const firstNamedKey = (name: string): string | undefined => {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  try {
    const values = Object.values(JSON.parse(raw) as Record<string, string>);
    return values.find(
      (value) => typeof value === "string" && value.length > 0,
    );
  } catch {
    return undefined;
  }
};

export const supabaseUrl = () => required("SUPABASE_URL");

export const publishableKey = () =>
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  firstNamedKey("SUPABASE_PUBLISHABLE_KEYS") ??
  required("SUPABASE_PUBLISHABLE_KEY");

export const secretKey = () =>
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  firstNamedKey("SUPABASE_SECRET_KEYS") ??
  required("SUPABASE_SECRET_KEY");

export const createUserClient = (authorization: string): SupabaseClient =>
  createClient(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

export const createAdminClient = (): SupabaseClient =>
  createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const allowedOrigins = (): Set<string> =>
  new Set(
    (
      Deno.env.get("ALLOWED_ORIGINS") ??
      "http://localhost:5173,http://127.0.0.1:5173"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

export const appUrl = (): string => {
  const configured = required("APP_URL").replace(/\/$/, "");
  const parsed = new URL(configured);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("INVALID_SERVER_CONFIG:APP_URL");
  return parsed.origin;
};

export const stripeSecretKey = () => required("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = () => required("STRIPE_WEBHOOK_SECRET");

export const metaConfig = () => ({
  appId: required("META_INSTAGRAM_APP_ID"),
  appSecret: required("META_INSTAGRAM_APP_SECRET"),
  redirectUri: required("META_REDIRECT_URI"),
  graphVersion: required("META_GRAPH_VERSION")
    .replace(/^\//, "")
    .replace(/\/$/, ""),
});
