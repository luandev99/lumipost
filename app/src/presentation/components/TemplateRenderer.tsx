import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  Content,
  TemplateLayer,
  VisualTemplateV2,
} from "../../domain/models";

const resolveValue = (value: unknown, props: Record<string, string>) =>
  typeof value === "string"
    ? value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => props[key] ?? "")
    : value;
const resolveStyles = (
  styles: Record<string, unknown> | undefined,
  props: Record<string, string>,
): CSSProperties =>
  Object.fromEntries(
    Object.entries(styles ?? {}).map(([key, value]) => [
      key,
      resolveValue(value, props),
    ]),
  ) as CSSProperties;
const resolvePosition = (
  position: TemplateLayer["position"],
  props: Record<string, string>,
): CSSProperties =>
  ({
    position: "absolute",
    top: resolveValue(position?.top ?? "0", props),
    left: resolveValue(position?.left ?? "0", props),
    width: resolveValue(position?.width ?? "auto", props),
    height: resolveValue(position?.height ?? "auto", props),
  }) as CSSProperties;

function Layer({
  layer,
  props,
}: {
  layer: TemplateLayer;
  props: Record<string, string>;
}) {
  if (layer.editorMeta?.hidden) return null;
  const style = {
    ...resolvePosition(layer.position, props),
    ...resolveStyles(layer.styles, props),
    zIndex: layer.zIndex ?? 1,
  } as CSSProperties;
  const content =
    typeof layer.content === "string" ? { text: layer.content } : layer.content;
  const text = String(
    resolveValue(content?.text ?? props[layer.fieldName ?? ""] ?? "", props),
  );
  const src = String(
    resolveValue(content?.source ?? props[layer.fieldName ?? ""] ?? "", props),
  );
  if (layer.type === "text" || layer.type === "text-path")
    return (
      <div className="template-layer template-text" style={style}>
        {text}
      </div>
    );
  if (layer.type === "image")
    return (
      <div className="template-layer" style={style}>
        {src ? (
          <img className="template-image" src={src} alt={content?.alt ?? ""} />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-violet-300/40 to-purple-700/30" />
        )}
      </div>
    );
  if (layer.type === "svg" || layer.type === "path") {
    const markup = String(
      resolveValue(content?.embedded?.svgContent ?? "", {
        ...props,
        ...(content?.embedded?.colors ?? {}),
      }),
    );
    return (
      <div
        className="template-layer"
        style={style}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }
  if (layer.type === "list-container") {
    const items = Object.entries(props)
      .filter(([key]) =>
        key.startsWith(
          String(layer.listConfig?.itemVariablePrefix ?? "listItem"),
        ),
      )
      .map(([, value]) => value)
      .filter(Boolean);
    return (
      <div className="template-layer flex-col gap-2" style={style}>
        {items.map((item, index) => (
          <div key={`${item}-${index}`} className="flex gap-2">
            <b>{index + 1}.</b>
            {item}
          </div>
        ))}
      </div>
    );
  }
  const radius = layer.type === "ellipse" ? "50%" : style.borderRadius;
  return (
    <div className="template-layer" style={{ ...style, borderRadius: radius }}>
      {text}
    </div>
  );
}

export function TemplateCanvas({
  spec,
  props: overrideProps = {},
  width = 330,
  className = "",
}: {
  spec: VisualTemplateV2;
  props?: Record<string, string>;
  width?: number;
  className?: string;
}) {
  const scale = width / spec.dimensions.width;
  const height = spec.dimensions.height * scale;
  const props = { ...spec.props, ...overrideProps };
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <div
        className="template-canvas"
        style={{
          width: spec.dimensions.width,
          height: spec.dimensions.height,
          transform: `scale(${scale})`,
          ["--image-width" as string]: `${spec.dimensions.width}px`,
          ["--image-height-post" as string]: "1350px",
          ["--image-height-story" as string]: "1920px",
        }}
      >
        {[...spec.layers]
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((layer) => (
            <Layer key={layer.id} layer={layer} props={props} />
          ))}
      </div>
    </div>
  );
}

export function TemplateFromPath({
  path,
  props,
  width,
  className,
}: {
  path: string;
  props: Record<string, string>;
  width?: number;
  className?: string;
}) {
  const [spec, setSpec] = useState<VisualTemplateV2>();
  useEffect(() => {
    let active = true;
    fetch(path)
      .then((res) => res.json())
      .then((data) => active && setSpec(data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path]);
  if (!spec)
    return (
      <div
        className={`animate-pulse-soft bg-gradient-to-br from-violet-100 to-violet-300 dark:from-violet-950 dark:to-purple-800 ${className}`}
        style={{ width: width ?? 330, aspectRatio: "4 / 5" }}
      />
    );
  return (
    <TemplateCanvas
      spec={spec}
      props={props}
      width={width}
      className={className}
    />
  );
}

export function ContentPreview({
  content,
  width = 330,
  className = "",
  interactive = false,
}: {
  content: Content;
  // Aceita "100%" para preencher um container de largura variável (ex.:
  // grid de cards) — TemplateCanvas ainda precisa de um número em px para
  // calcular a escala do template, então nesse caso ele cai no padrão.
  width?: number | string;
  className?: string;
  interactive?: boolean;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slideCount = content.mediaUrls.length;
  useEffect(() => {
    setSlideIndex(0);
  }, [content.id]);
  const currentSlide = Math.min(slideIndex, Math.max(0, slideCount - 1));
  const props = useMemo(
    () => ({
      headline: content.title,
      title: content.title,
      mainText: content.title,
      subtitle: content.caption,
      description: content.caption,
      ctaText: content.cta,
      cta: content.cta,
      image: content.mediaUrls[0] ?? "",
      photo: content.mediaUrls[0] ?? "",
      businessLogo: "",
      brandName: "",
      instagramHandle: "",
      textColor1: "#F8F7FF",
      textColor2: "#EDE9FE",
      textColor3: "#FFFFFF",
      bgColor1: "#111827",
      bgColor2: "#7C3AED",
      bgColor3: "#C4B5FD",
      listItem1: content.slideTexts?.[1] ?? "",
      listItem2: content.slideTexts?.[2] ?? "",
      listItem3: content.slideTexts?.[3] ?? "",
    }),
    [content],
  );
  if (content.format === "caption")
    return (
      <div
        className={`flex flex-col justify-between bg-gradient-to-br from-[#1f1634] to-[#6d28d9] p-[10%] text-white ${className}`}
        style={{ width, aspectRatio: "1 / 1" }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-200">
          Legenda pronta
        </span>
        <div>
          <h3 className="font-serif text-[clamp(16px,5vw,30px)] leading-tight">
            {content.title}
          </h3>
          <p className="mt-3 line-clamp-6 text-[11px] text-white/75">
            {content.caption}
          </p>
        </div>
      </div>
    );
  if (content.format === "reel" || content.format === "video") {
    const videoUrl = content.mediaUrls.find((url) =>
      /\.mp4(?:\?|$)/i.test(url),
    );
    const coverUrl = content.mediaUrls.find(
      (url) => !/\.mp4(?:\?|$)/i.test(url),
    );
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#0d1323] via-[#24113f] to-[#6d28d9] text-white ${className}`}
        style={{ width, aspectRatio: "9 / 16" }}
      >
        {videoUrl && (
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-55"
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
          />
        )}
        {!videoUrl && coverUrl && (
          <img
            className="absolute inset-0 h-full w-full object-cover opacity-55"
            src={coverUrl}
            alt="Capa do conteúdo"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#120a22] via-transparent to-black/20" />
        <div className="relative flex h-full flex-col justify-between p-[9%]">
          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
            {content.format === "video" ? "Vídeo" : "Reel"} ·{" "}
            {content.reelScript?.duration ?? 24}s
          </span>
          <div>
            <div className="mb-3 h-px w-10 bg-violet-300" />
            <h3 className="font-serif text-[clamp(18px,6vw,34px)] leading-tight">
              {content.reelScript?.hook ?? content.title}
            </h3>
            <p className="mt-3 text-[11px] text-white/70">
              {videoUrl
                ? "Vídeo pronto para publicação"
                : content.status === "generating"
                  ? "Vídeo sendo gerado pelo Higgsfield…"
                  : "Capa e roteiro gerados"}
            </p>
          </div>
          <span className="text-[10px] font-bold">
            {content.source === "ai" ? "Lumipost.ai" : "Conteúdo enviado"}
          </span>
        </div>
      </div>
    );
  }
  if (content.mediaUrls[0]) {
    const isCarousel = content.format === "carousel" && slideCount > 1;
    return (
      <div
        className={`relative overflow-hidden bg-black/5 ${className}`}
        style={{
          width,
          aspectRatio: content.format === "story" ? "9 / 16" : "4 / 5",
        }}
      >
        <img
          src={content.mediaUrls[currentSlide]}
          alt={content.altText || content.title}
          className="h-full w-full object-cover"
        />
        {isCarousel && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white">
            {currentSlide + 1}/{slideCount}
          </span>
        )}
        {isCarousel && interactive && (
          <>
            {currentSlide > 0 && (
              <button
                type="button"
                aria-label="Slide anterior"
                onClick={() => setSlideIndex(currentSlide - 1)}
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {currentSlide < slideCount - 1 && (
              <button
                type="button"
                aria-label="Próximo slide"
                onClick={() => setSlideIndex(currentSlide + 1)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <ChevronRight size={18} />
              </button>
            )}
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {content.mediaUrls.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Ir para o slide ${index + 1}`}
                  onClick={() => setSlideIndex(index)}
                  className={`h-1.5 w-1.5 rounded-full ${index === currentSlide ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
  return content.templatePath ? (
    <TemplateFromPath
      path={content.templatePath}
      props={props}
      width={typeof width === "number" ? width : undefined}
      className={className}
    />
  ) : (
    <div
      className={`flex items-center bg-gradient-to-br from-[#121a2a] to-[#24113f] p-8 text-white ${className}`}
      style={{
        width,
        aspectRatio: content.format === "story" ? "9 / 16" : "4 / 5",
      }}
    >
      <h3 className="font-serif text-3xl leading-tight">{content.title}</h3>
    </div>
  );
}
