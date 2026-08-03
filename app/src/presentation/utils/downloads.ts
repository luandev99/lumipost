import JSZip from "jszip";
import type { Content } from "../../domain/models";

const trigger = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const safe = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function artwork(
  content: Content,
  text: string,
  ratio: "4:5" | "9:16" = "4:5",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = ratio === "9:16" ? 1920 : 1350;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.55, "#23113e");
  gradient.addColorStop(1, "#7c3aed");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,.12)";
  context.beginPath();
  context.arc(880, 260, 280, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "700 74px Arial";
  context.textBaseline = "top";
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const attempt = `${line} ${word}`.trim();
    if (context.measureText(attempt).width > 850 && line) {
      lines.push(line);
      line = word;
    } else line = attempt;
  }
  lines.push(line);
  lines
    .slice(0, 6)
    .forEach((item, index) =>
      context.fillText(item, 90, canvas.height * 0.35 + index * 88),
    );
  context.fillStyle = "#c4b5fd";
  context.font = "600 28px Arial";
  context.fillText("Lumipost.ai", 90, canvas.height - 110);
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/png"),
  );
}

export async function downloadContent(content: Content) {
  const name = safe(content.title) || "conteudo";
  if (content.source === "upload" && content.mediaUrls[0]) {
    const response = await fetch(content.mediaUrls[0]);
    trigger(
      await response.blob(),
      `${name}.${content.format === "reel" ? "mp4" : "png"}`,
    );
    return;
  }
  if (content.format === "carousel") {
    const zip = new JSZip();
    const slides = content.slideTexts?.length
      ? content.slideTexts
      : [content.title, content.caption, content.cta];
    for (let index = 0; index < slides.length; index += 1)
      zip.file(
        `${String(index + 1).padStart(2, "0")}.png`,
        await artwork(content, slides[index]),
      );
    trigger(await zip.generateAsync({ type: "blob" }), `${name}.zip`);
    return;
  }
  if (content.format === "reel") {
    const zip = new JSZip();
    zip.file("roteiro.json", JSON.stringify(content.reelScript, null, 2));
    zip.file(
      "capa.png",
      await artwork(content, content.reelScript?.hook ?? content.title, "9:16"),
    );
    const videoUrl = content.mediaUrls.find((url) =>
      /\.mp4(?:\?|$)/i.test(url),
    );
    if (videoUrl) {
      const response = await fetch(videoUrl);
      if (response.ok) zip.file("reel.mp4", await response.blob());
    }
    trigger(await zip.generateAsync({ type: "blob" }), `${name}.zip`);
    return;
  }
  trigger(
    await artwork(
      content,
      content.title,
      content.format === "story" ? "9:16" : "4:5",
    ),
    `${name}.png`,
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  trigger(blob, filename);
}
