"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FORMATS } from "@/lib/content";

const ASPECT: Record<string, string> = {
  "1:1": "aspect-square w-[7.5rem]",
  "4:5": "aspect-[4/5] w-[6.5rem]",
  "9:16": "aspect-[9/16] w-[5rem]",
  "16:9": "aspect-video w-[10rem]",
};

/** Miniatura com a proporção real do formato. */
function FormatPreview({ ratio }: { ratio: string }) {
  if (ratio === "—") {
    return (
      <div className="flex w-[10rem] flex-col gap-2.5">
        {[100, 82, 92, 64].map((width, index) => (
          <span
            key={index}
            className="block h-2 rounded-full bg-white/12"
            style={{ width: `${width}%` }}
          />
        ))}
        <span className="mt-1 block h-2 w-1/2 rounded-full bg-app-primary/50" />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-white/10 ${ASPECT[ratio] ?? "aspect-square w-[7.5rem]"}`}
      style={{
        background:
          "linear-gradient(150deg, rgba(169,112,255,0.42), rgba(59,7,100,0.6) 60%, rgba(10,10,14,0.9))",
      }}
    >
      <span className="flex w-full flex-col gap-1.5 px-3">
        <span className="block h-1.5 w-3/4 rounded-full bg-white/45" />
        <span className="block h-1.5 w-1/2 rounded-full bg-white/25" />
      </span>
    </div>
  );
}

export default function FormatsRail() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sectionEl = section.current;
    const trackEl = track.current;
    if (!sectionEl || !trackEl) return;

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      const distance = () =>
        Math.max(0, trackEl.scrollWidth - window.innerWidth + 96);

      gsap.to(trackEl, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: sectionEl,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
    }, sectionEl);

    return () => context.revert();
  }, []);

  return (
    <section
      id="formatos"
      ref={section}
      className="relative h-[280vh]"
      aria-label="Formatos gerados"
    >
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-6">
          <span className="eyebrow">Formatos</span>
          <h2 className="display mt-6 max-w-2xl text-[clamp(2.2rem,5.4vw,4rem)]">
            Quatro formatos.{" "}
            <span className="text-gradient italic">Um único briefing.</span>
          </h2>
        </div>

        <div className="mt-14 overflow-hidden">
          <div ref={track} className="flex w-max gap-5 pl-6 sm:pl-[max(1.5rem,calc(50vw-36rem))]">
            {FORMATS.map((format, index) => (
              <article
                key={format.name}
                className="glass-panel relative flex h-[24rem] w-[17rem] shrink-0 flex-col justify-between overflow-hidden rounded-[2rem] p-7 sm:h-[27rem] sm:w-[20rem]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-24 h-56 opacity-70 blur-3xl"
                  style={{
                    background:
                      index % 2 === 0
                        ? "radial-gradient(circle, rgba(169,112,255,0.35), transparent 70%)"
                        : "radial-gradient(circle, rgba(124,58,237,0.3), transparent 70%)",
                  }}
                />
                <div className="relative">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-app-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="display mt-6 text-4xl">{format.name}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-app-muted">
                    {format.body}
                  </p>
                </div>

                <div className="relative flex flex-1 items-center justify-center py-6">
                  <FormatPreview ratio={format.ratio} />
                </div>

                <div className="relative flex items-center justify-between border-t border-white/[0.07] pt-5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-app-muted">
                    proporção
                  </span>
                  <span className="rounded-full bg-app-primary/12 px-3 py-1 text-xs font-bold text-app-primary ring-1 ring-app-primary/20">
                    {format.ratio}
                  </span>
                </div>
              </article>
            ))}

            <article className="relative flex h-[24rem] w-[17rem] shrink-0 flex-col justify-center gap-4 rounded-[2rem] border border-dashed border-app-primary/30 bg-app-primary/[0.05] p-7 text-center sm:h-[27rem] sm:w-[20rem]">
              <p className="display text-3xl text-gradient">
                E os próximos que a sua marca pedir.
              </p>
              <p className="text-sm text-app-muted">
                Templates novos entram sem quebrar o que já está agendado.
              </p>
            </article>
          </div>
        </div>

        <p className="mx-auto mt-12 w-full max-w-6xl px-6 text-xs font-semibold uppercase tracking-[0.22em] text-app-muted/70">
          continue rolando
        </p>
      </div>
    </section>
  );
}
