// Redimensiona e comprime imagens ANTES do upload — economiza banda e
// tokens de imagem na chamada de geração (resolução maior que 1024px não
// traz benefício real pro modelo de imagem, que trabalha internamente numa
// resolução fixa). SVG é vetor, ignorado; vídeo passa direto.
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

export const optimizeImageFile = async (
  file: File,
  options: { forceJpeg?: boolean } = {},
): Promise<File> => {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml")
    return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    // Já está pequena e no formato certo — não vale reprocessar.
    if (scale === 1 && !options.forceJpeg) return file;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    const useJpeg = options.forceJpeg ?? false;
    const outputType = useJpeg ? "image/jpeg" : file.type;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, useJpeg ? JPEG_QUALITY : undefined),
    );
    if (!blob) return file;
    const extension = useJpeg ? "jpg" : (file.name.split(".").pop() ?? "png");
    const baseName = file.name.replace(/\.[^./]+$/, "");
    return new File([blob], `${baseName}.${extension}`, { type: outputType });
  } catch {
    // Falha de decodificação (formato exótico, corrompido) — sobe o
    // arquivo original em vez de bloquear o usuário por uma otimização.
    return file;
  }
};
