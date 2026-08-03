import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripVertical,
  ImagePlus,
  Palette,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

export interface CarouselSlide {
  id: string;
  text: string;
  url?: string;
  file?: File;
  cover?: boolean;
  alignment?: "left" | "center" | "right";
  font?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  template?: string;
}

function SortableSlide({
  slide,
  index,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  onCover,
  onImage,
}: {
  slide: CarouselSlide;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onCover: () => void;
  onImage: (file: File) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`w-32 shrink-0 rounded-2xl border p-2 ${selected ? "border-app-primary bg-app-soft" : "border-app-border bg-app-surface"} ${isDragging ? "z-20 opacity-60 shadow-2xl" : ""}`}
    >
      <button
        type="button"
        className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl"
        style={{
          background: slide.backgroundColor || "#201832",
          color: slide.textColor || "#fff",
          textAlign: slide.alignment || "center",
          fontFamily: slide.font || "Inter",
        }}
        onClick={onSelect}
      >
        {slide.url ? (
          <img
            src={slide.url}
            alt={`Slide ${index + 1}`}
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
        ) : null}
        <span
          className="relative z-10 px-2 font-bold leading-tight"
          style={{ fontSize: Math.max(8, (slide.fontSize ?? 34) / 3) }}
        >
          {slide.text || `Slide ${index + 1}`}
        </span>
        {slide.cover && (
          <span className="absolute left-1 top-1 rounded-full bg-app-primary px-1.5 py-0.5 text-[8px] font-bold text-white">
            Capa
          </span>
        )}
      </button>
      <div className="mt-2 flex justify-between">
        <button
          type="button"
          className="p-1 text-app-muted"
          {...attributes}
          {...listeners}
          aria-label="Reordenar slide"
        >
          <GripVertical size={14} />
        </button>
        <label
          className="cursor-pointer p-1 text-app-muted"
          title="Substituir imagem"
        >
          <ImagePlus size={14} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImage(file);
            }}
          />
        </label>
        <button
          type="button"
          className="p-1 text-app-muted"
          onClick={onCover}
          title="Definir capa"
        >
          <Star size={14} />
        </button>
        <button
          type="button"
          className="p-1 text-app-muted"
          onClick={onDuplicate}
          title="Duplicar"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="p-1 text-red-500"
          onClick={onRemove}
          title="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function CarouselEditor({
  slides,
  onChange,
}: {
  slides: CarouselSlide[];
  onChange: (slides: CarouselSlide[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(slides[0]?.id ?? "");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const selected = slides.find((slide) => slide.id === selectedId) ?? slides[0];
  const update = (id: string, patch: Partial<CarouselSlide>) =>
    onChange(
      slides.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    );
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((slide) => slide.id === active.id);
    const to = slides.findIndex((slide) => slide.id === over.id);
    onChange(arrayMove(slides, from, to));
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <b className="text-sm">Slides do carrossel</b>
          <p className="text-muted text-xs">
            Arraste para reordenar · máximo 10
          </p>
        </div>
        <button
          type="button"
          disabled={slides.length >= 10}
          className="btn-secondary"
          onClick={() => {
            const next = {
              id: `slide-${Date.now()}`,
              text: `Novo slide ${slides.length + 1}`,
              backgroundColor: "#201832",
              textColor: "#ffffff",
            };
            onChange([...slides, next]);
            setSelectedId(next.id);
          }}
        >
          <Plus size={15} />
          Slide
        </button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext
          items={slides.map((slide) => slide.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <SortableSlide
                key={slide.id}
                slide={slide}
                index={index}
                selected={selected?.id === slide.id}
                onSelect={() => setSelectedId(slide.id)}
                onDuplicate={() => {
                  if (slides.length >= 10) return;
                  const copy = {
                    ...slide,
                    id: `slide-${Date.now()}`,
                    cover: false,
                  };
                  onChange([
                    ...slides.slice(0, index + 1),
                    copy,
                    ...slides.slice(index + 1),
                  ]);
                  setSelectedId(copy.id);
                }}
                onRemove={() => {
                  if (slides.length <= 2) return;
                  onChange(slides.filter((item) => item.id !== slide.id));
                  if (selectedId === slide.id)
                    setSelectedId(
                      slides.find((item) => item.id !== slide.id)?.id ?? "",
                    );
                }}
                onCover={() =>
                  onChange(
                    slides.map((item) => ({
                      ...item,
                      cover: item.id === slide.id,
                    })),
                  )
                }
                onImage={(file) =>
                  update(slide.id, { file, url: URL.createObjectURL(file) })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {selected && (
        <div className="surface-subtle mt-3 space-y-3 p-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Texto do slide em destaque
            </span>
            <textarea
              className="field min-h-20"
              value={selected.text}
              onChange={(event) =>
                update(selected.id, { text: event.target.value })
              }
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-semibold">
              Template
              <select
                className="field mt-1"
                value={selected.template ?? "brand"}
                onChange={(event) =>
                  update(selected.id, { template: event.target.value })
                }
              >
                <option value="brand">Identidade da marca</option>
                <option value="minimal">Minimalista</option>
                <option value="editorial">Editorial</option>
                <option value="promo">Promocional</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Alinhamento
              <select
                className="field mt-1"
                value={selected.alignment ?? "center"}
                onChange={(event) =>
                  update(selected.id, {
                    alignment: event.target.value as CarouselSlide["alignment"],
                  })
                }
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Fonte
              <select
                className="field mt-1"
                value={selected.font ?? "Inter"}
                onChange={(event) =>
                  update(selected.id, { font: event.target.value })
                }
              >
                <option>Inter</option>
                <option>Playfair Display</option>
                <option>Montserrat</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              Tamanho: {selected.fontSize ?? 34}px
              <input
                className="mt-3 w-full accent-violet-600"
                type="range"
                min="18"
                max="72"
                value={selected.fontSize ?? 34}
                onChange={(event) =>
                  update(selected.id, { fontSize: Number(event.target.value) })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Cor do texto
              <input
                className="field mt-1 p-1"
                type="color"
                value={selected.textColor ?? "#ffffff"}
                onChange={(event) =>
                  update(selected.id, { textColor: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold">
              Cor de fundo
              <input
                className="field mt-1 p-1"
                type="color"
                value={selected.backgroundColor ?? "#201832"}
                onChange={(event) =>
                  update(selected.id, { backgroundColor: event.target.value })
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() =>
              update(selected.id, {
                template: "brand",
                font: "Playfair Display",
                textColor: "#ffffff",
                backgroundColor: "#7c3aed",
              })
            }
          >
            <Palette size={15} />
            Aplicar identidade visual
          </button>
        </div>
      )}
    </div>
  );
}
