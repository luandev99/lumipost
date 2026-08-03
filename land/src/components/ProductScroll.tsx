"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STORY_STEPS } from "@/lib/content";
import { productScroll, stepFromProgress } from "@/three/scrollState";

const PhoneCanvas = dynamic(() => import("@/three/PhoneCanvas"), {
  ssr: false,
});

export default function ProductScroll() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const element = section.current;
    if (!element) return;

    gsap.registerPlugin(ScrollTrigger);

    const trigger = ScrollTrigger.create({
      trigger: element,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        productScroll.progress = self.progress;
        const step = stepFromProgress(self.progress);
        setActive((current) => (current === step ? current : step));
      },
    });

    return () => trigger.kill();
  }, []);

  return (
    <section
      id="produto"
      ref={section}
      className="relative h-[420vh]"
      aria-label="Como o Lumipost funciona"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* cena 3D */}
        <div className="absolute inset-0 z-0">
          <PhoneCanvas />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-32 bg-gradient-to-b from-app-bg to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[58%] bg-gradient-to-t from-app-bg via-app-bg/92 to-transparent lg:h-40 lg:via-app-bg/80" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-6 pb-24 lg:items-center lg:pb-0">
          <div className="w-full lg:grid lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="eyebrow mb-8 hidden lg:inline-flex">
                Do briefing ao post publicado
              </p>

              {/* trilho de progresso */}
              <div className="mb-8 flex items-center gap-2 lg:mb-10">
                {STORY_STEPS.map((step, index) => (
                  <span
                    key={step.id}
                    className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10"
                  >
                    <span
                      className={`block h-full rounded-full bg-gradient-to-r from-app-primary to-app-accent transition-all duration-700 ${
                        index <= active ? "w-full" : "w-0"
                      }`}
                    />
                  </span>
                ))}
              </div>

              <div className="relative min-h-[15rem] sm:min-h-[14rem] lg:min-h-[20rem]">
                {STORY_STEPS.map((step, index) => {
                  const isActive = index === active;
                  return (
                    <article
                      key={step.id}
                      aria-hidden={!isActive}
                      className={`absolute inset-x-0 top-0 transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${
                        isActive
                          ? "translate-y-0 opacity-100 blur-0"
                          : "pointer-events-none translate-y-6 opacity-0 blur-sm"
                      }`}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-app-primary">
                        {step.kicker}
                      </p>
                      <h2 className="display mt-4 text-[clamp(2rem,4.6vw,3.6rem)] text-app-text">
                        {step.title}
                      </h2>
                      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-app-muted sm:text-base">
                        {step.body}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
