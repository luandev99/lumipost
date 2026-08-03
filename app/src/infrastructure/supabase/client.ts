import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isSupabaseConfigured =
  import.meta.env.MODE !== "test" && Boolean(url && publishableKey);

let singleton: SupabaseClient | undefined;

export const getSupabaseClient = (): SupabaseClient => {
  if (!isSupabaseConfigured || !url || !publishableKey) {
    throw new Error(
      "Supabase não configurado. Defina somente URL e publishable key no frontend.",
    );
  }
  singleton ??= createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "lumipost.auth",
    },
    global: { headers: { "X-Client-Info": "lumipost-web/1.0" } },
  });
  return singleton;
};

export const invokeSecureFunction = async <T>(
  name: string,
  body: unknown,
): Promise<T> => {
  const { data, error } = await getSupabaseClient().functions.invoke(name, {
    body: body as Record<string, unknown>,
  });
  if (error)
    throw new Error(error.message || "Falha ao acessar o backend seguro.");
  if (data?.error)
    throw new Error(
      data.error.message ||
        data.error.code ||
        "Falha ao acessar o backend seguro.",
    );
  return data as T;
};
