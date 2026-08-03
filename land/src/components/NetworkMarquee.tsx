import { NETWORKS } from "@/lib/content";

export default function NetworkMarquee() {
  const items = [...NETWORKS, ...NETWORKS];

  return (
    <section
      aria-label="Redes e formatos suportados"
      className="relative border-y border-white/[0.06] bg-white/[0.015] py-7"
    >
      <div className="mask-fade-x overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-12 pr-12">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="flex shrink-0 items-center gap-12 text-lg font-semibold tracking-tight text-app-muted/70 transition-colors sm:text-xl"
            >
              {item}
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-app-primary/60"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
