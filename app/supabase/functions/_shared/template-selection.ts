import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type SelectedVisualTemplate = { templateKey: string; name: string; packageId: string; aspectRatio: string; width: number; height: number; specPath: string };

const indexFor = (length: number) => { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return length ? bytes[0] % length : 0; };

export const selectVisualTemplate = async (admin: SupabaseClient, format: string, packages: string[] = []): Promise<SelectedVisualTemplate | null> => {
  const normalized = ["story", "reel", "video"].includes(format) ? "story" : format === "caption" ? "post" : format;
  let query = admin.from("visual_templates").select("template_key,name,package_id,aspect_ratio,width,height,spec_path").eq("format", normalized).eq("status", "published").limit(200);
  if (packages.length) query = query.in("package_id", packages.slice(0, 50));
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) return null;
  const template = data[indexFor(data.length)];
  return { templateKey: template.template_key, name: template.name, packageId: template.package_id, aspectRatio: template.aspect_ratio, width: template.width, height: template.height, specPath: template.spec_path };
};
