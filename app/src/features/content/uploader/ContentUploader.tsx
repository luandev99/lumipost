import { useRef, useState, type DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileImage,
  FileVideo,
  UploadCloud,
  X,
} from "lucide-react";
import type { ContentFormat } from "../../../domain/models";
import { formatLabels } from "../../../domain/models";
import {
  Badge,
  Button,
  Input,
  Notice,
  Select,
  Textarea,
} from "../../../presentation/ui";
import type { PreparedContent } from "../types";

interface UploadItem {
  file: File;
  url: string;
  type: "image" | "video";
}
const formats: ContentFormat[] = ["post", "carousel", "story", "reel", "video"];

export function ContentUploader({
  onReady,
  onBack,
}: {
  onReady: (content: PreparedContent) => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [format, setFormat] = useState<ContentFormat>("post");
  const [title, setTitle] = useState("Conteúdo enviado");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [warning, setWarning] = useState("");
  const addFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(
      (file) => file.type.startsWith("image/") || file.type === "video/mp4",
    );
    const rejected = Array.from(files).length - accepted.length;
    setWarning(
      rejected
        ? `${rejected} arquivo(s) incompatível(is) foram ignorados. Use imagens ou MP4.`
        : "",
    );
    const next = accepted
      .slice(0, 10)
      .map((file) => ({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith("video/")
          ? ("video" as const)
          : ("image" as const),
      }));
    setItems(next);
    if (next.length > 1) setFormat("carousel");
    else if (next[0]?.type === "video") setFormat("reel");
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };
  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const prepared: PreparedContent = {
    source: "upload",
    title,
    topic: title,
    format,
    caption,
    hashtags: hashtags.split(/\s+/).filter(Boolean),
    cta: "",
    mediaUrls: items.map((item) => item.url),
    mediaFiles: items.map((item) => item.file),
    slides: format === "carousel" ? items.length : 1,
    creditCost: 0,
    firstComment,
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
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
            className="surface-subtle flex min-h-52 flex-col items-center justify-center border-dashed p-6 text-center"
          >
            <UploadCloud className="mb-3 text-app-primary" size={34} />
            <b>Arraste seus arquivos aqui</b>
            <p className="text-muted mt-1 text-xs">
              Imagens JPG/PNG/WebP ou vídeo MP4 · até 10 arquivos
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              Selecionar arquivos
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/mp4"
              multiple
              className="hidden"
              onChange={(event) =>
                event.target.files && addFiles(event.target.files)
              }
            />
          </div>
          {warning && <Notice tone="error">{warning}</Notice>}
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.map((item, index) => (
                <div
                  key={`${item.file.name}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-xl bg-app-elevated"
                >
                  {item.type === "image" ? (
                    <img
                      src={item.url}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                    aria-label="Remover arquivo"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Título interno"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Select
              label="Formato"
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as ContentFormat)
              }
            >
              {formats.map((item) => (
                <option key={item} value={item}>
                  {formatLabels[item]}
                </option>
              ))}
            </Select>
          </div>
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
          <Textarea
            label="Primeiro comentário"
            value={firstComment}
            onChange={(event) => setFirstComment(event.target.value)}
          />
          <Button
            className="w-full"
            disabled={!items.length || !title.trim()}
            onClick={() => onReady(prepared)}
          >
            Revisar e agendar <ArrowRight size={17} />
          </Button>
        </div>
        <aside className="space-y-3">
          <div className="surface-subtle p-4">
            <p className="eyebrow mb-3">Validação da mídia</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-500" size={17} />
                <span>{items.length || 0} arquivo(s)</span>
              </div>
              <div className="flex items-center gap-2">
                {items.some((item) => item.type === "video") ? (
                  <FileVideo className="text-app-primary" size={17} />
                ) : (
                  <FileImage className="text-app-primary" size={17} />
                )}
                <span>{(totalSize / 1024 / 1024).toFixed(1)} MB no total</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-500" size={17} />
                <span>Tipo e tamanho validados antes do envio</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-500" size={17} />
                <span>Upload privado pelo Supabase Storage</span>
              </div>
            </div>
          </div>
          <Badge tone="success">Upload não consome créditos</Badge>
        </aside>
      </div>
    </div>
  );
}
