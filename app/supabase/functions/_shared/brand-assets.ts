import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  describeReferenceImageWithOpenAI,
  type BrandImageAsset,
} from "./openai.ts";

// Cada imagem a mais no request de edição custa latência e dilui a atenção
// do modelo sobre o resto do prompt — 4 cobre logo+logomarca+1 extra com
// folga, sem virar uma sopa de imagens que o modelo não sabe o que fazer.
export const MAX_EDIT_IMAGES = 4;

const fetchBytes = async (
  admin: SupabaseClient,
  bucket: string,
  path: string,
): Promise<Uint8Array | null> => {
  const { data: signed, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 15);
  if (error || !signed?.signedUrl) return null;
  const response = await fetch(signed.signedUrl);
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
};

type Slot =
  | {
      role: "logo" | "logomark" | "style-reference";
      bucket: "brand-assets";
      path: string;
    }
  | { role: "reference-photo"; bytes: Uint8Array };

// Resolve todas as imagens candidatas de uma geração — logo/logomarca da
// marca, a foto de referência específica desta peça (se enviada em modo
// "base") e até 5 referências de estilo da identidade — combinando-as numa
// única lista, respeitando um teto e uma ordem de prioridade. Qualquer asset
// que não exista é simplesmente omitido: nunca um placeholder.
export const resolveGenerationImageAssets = async (
  admin: SupabaseClient,
  input: {
    brand: Record<string, unknown> | null;
    referenceImagePath?: string;
    referenceMode?: "base" | "context";
    userId: string;
  },
): Promise<{ images: BrandImageAsset[]; referenceDescription?: string }> => {
  const brand = input.brand;
  let referenceDescription: string | undefined;
  let referencePhotoBytes: Uint8Array | undefined;

  // A foto de referência específica desta peça é uma escolha deliberada do
  // usuário para ESTA geração — ao contrário dos assets ambientes da marca,
  // uma falha aqui deve ser visível (erro), não silenciosamente ignorada.
  if (input.referenceImagePath) {
    const { data: signedRef, error: signedRefError } = await admin.storage
      .from("content-uploads")
      .createSignedUrl(input.referenceImagePath, 60 * 15);
    if (signedRefError || !signedRef?.signedUrl)
      throw signedRefError ?? new Error("REFERENCE_IMAGE_NOT_FOUND");
    if (input.referenceMode === "base") {
      const response = await fetch(signedRef.signedUrl);
      if (!response.ok) throw new Error("REFERENCE_IMAGE_FETCH_FAILED");
      referencePhotoBytes = new Uint8Array(await response.arrayBuffer());
    } else {
      referenceDescription = await describeReferenceImageWithOpenAI(
        signedRef.signedUrl,
        input.userId,
      );
    }
  }

  const styleReferencePaths = Array.isArray(brand?.reference_image_paths)
    ? (brand!.reference_image_paths as string[])
    : [];
  const slots: Slot[] = [];
  if (brand?.logo_path)
    slots.push({
      role: "logo",
      bucket: "brand-assets",
      path: brand.logo_path as string,
    });
  if (brand?.logomark_path)
    slots.push({
      role: "logomark",
      bucket: "brand-assets",
      path: brand.logomark_path as string,
    });
  if (referencePhotoBytes)
    slots.push({ role: "reference-photo", bytes: referencePhotoBytes });
  for (const path of styleReferencePaths)
    slots.push({ role: "style-reference", bucket: "brand-assets", path });

  const images: BrandImageAsset[] = [];
  for (const slot of slots.slice(0, MAX_EDIT_IMAGES)) {
    if ("bytes" in slot) {
      images.push({ bytes: slot.bytes, role: slot.role });
      continue;
    }
    const bytes = await fetchBytes(admin, slot.bucket, slot.path);
    if (bytes) images.push({ bytes, role: slot.role });
  }

  return { images, referenceDescription };
};
