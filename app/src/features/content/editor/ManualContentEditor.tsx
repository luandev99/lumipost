import { useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus } from "lucide-react";
import type { ContentFormat } from "../../../domain/models";
import { formatLabels } from "../../../domain/models";
import { AI_VIDEO_GENERATION_ENABLED } from "../../../domain/featureFlags";
import { Button, Input, Select, Textarea } from "../../../presentation/ui";
import { InstagramPreview } from "../components/InstagramPreview";
import { useAppSelector } from "../../../presentation/store/hooks";
import { connectedInstagramAccount } from "../../../presentation/utils/instagramGuard";
import type { PreparedContent } from "../types";
import { CarouselEditor, type CarouselSlide } from "./CarouselEditor";

const formats: ContentFormat[] = [
  "post",
  "carousel",
  "story",
  ...(AI_VIDEO_GENERATION_ENABLED ? (["reel", "video"] as const) : []),
  "caption",
];

export function ManualContentEditor({
  onReady,
  onBack,
}: {
  onReady: (content: PreparedContent) => void;
  onBack: () => void;
}) {
  const instagramAccount = connectedInstagramAccount(
    useAppSelector((state) => state.socialAccounts.items),
  );
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<ContentFormat>("post");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#aurorastudio");
  const [cta, setCta] = useState("Saiba mais");
  const [altText, setAltText] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [collaborators, setCollaborators] = useState("");
  const [taggedPeople, setTaggedPeople] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [slides, setSlides] = useState<CarouselSlide[]>([
    { id: "slide-1", text: "Capa do carrossel", cover: true },
    { id: "slide-2", text: "Desenvolva sua ideia" },
  ]);
  const prepared: PreparedContent = {
    source: "manual",
    title: title || "Nova publicação manual",
    topic: title || "Conteúdo manual",
    format,
    caption,
    hashtags: hashtags.split(/\s+/).filter(Boolean),
    cta,
    mediaUrls:
      format === "carousel"
        ? (slides.map((slide) => slide.url).filter(Boolean) as string[])
        : mediaUrls,
    mediaFiles:
      format === "carousel"
        ? slides
            .map((slide) => slide.file)
            .filter((file): file is File => Boolean(file))
        : mediaFiles,
    slideTexts:
      format === "carousel" ? slides.map((slide) => slide.text) : undefined,
    slides: format === "carousel" ? slides.length : 1,
    creditCost: 0,
    altText,
    location,
    link,
    firstComment,
    collaborators: collaborators
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    taggedPeople: taggedPeople
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((file) =>
      ["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(
        file.type,
      ),
    );
    setMediaFiles(accepted);
    setMediaUrls(accepted.map((file) => URL.createObjectURL(file)));
  };

  return (
    <div>
      <button
        className="mb-4 flex items-center gap-2 text-sm font-bold text-app-primary"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        Escolher outra origem
      </button>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Input
            label="Título interno"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Oferta de agosto"
          />
          <Select
            label="Formato"
            value={format}
            onChange={(event) => setFormat(event.target.value as ContentFormat)}
          >
            {formats.map((item) => (
              <option key={item} value={item}>
                {formatLabels[item]}
              </option>
            ))}
          </Select>
          {format === "carousel" ? (
            <CarouselEditor slides={slides} onChange={setSlides} />
          ) : (
            format !== "caption" && (
              <label className="surface-subtle flex min-h-28 cursor-pointer flex-col items-center justify-center border-dashed p-4 text-center">
                <ImagePlus className="mb-2 text-app-primary" />
                <b className="text-sm">Adicionar imagem ou vídeo</b>
                <span className="text-muted mt-1 text-xs">
                  Clique para selecionar arquivos
                </span>
                <input
                  className="hidden"
                  type="file"
                  multiple={false}
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  onChange={(event) => addFiles(event.target.files)}
                />
              </label>
            )
          )}
          <Textarea
            label="Legenda"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
          <Input
            label="Hashtags"
            value={hashtags}
            onChange={(event) => setHashtags(event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Chamada para ação"
              value={cta}
              onChange={(event) => setCta(event.target.value)}
            />
            <Input
              label="Localização"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <Input
              label="Link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            <Input
              label="Texto alternativo"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
            />
            <Input
              label="Colaboradores"
              value={collaborators}
              onChange={(event) => setCollaborators(event.target.value)}
              placeholder="@perfil1, @perfil2"
            />
            <Input
              label="Marcar pessoas"
              value={taggedPeople}
              onChange={(event) => setTaggedPeople(event.target.value)}
              placeholder="@cliente, @parceiro"
            />
          </div>
          <Textarea
            label="Primeiro comentário"
            value={firstComment}
            onChange={(event) => setFirstComment(event.target.value)}
          />
          <Button
            className="w-full"
            disabled={!title.trim()}
            onClick={() => onReady(prepared)}
          >
            Revisar e agendar <ArrowRight size={17} />
          </Button>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow mb-3">Preview em tempo real</p>
          <InstagramPreview
            content={prepared}
            mode={
              format === "story"
                ? "story"
                : format === "reel" || format === "video"
                  ? "reel"
                  : "feed"
            }
            handle={instagramAccount?.handle}
            avatarUrl={instagramAccount?.avatarUrl}
          />
        </div>
      </div>
    </div>
  );
}
