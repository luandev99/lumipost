"use client";

import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { ArrowRight, MousePointerClick, Play, Sparkles } from "lucide-react";
import { APP_URL, HERO_STATS, REGISTER_PATH } from "@/lib/content";

const HeroCanvas = dynamic(() => import("@/three/HeroCanvas"), { ssr: false });

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Hero() {
  return (
    <section
      id="topo"
      className="relative flex min-h-[100svh] items-center overflow-hidden pb-24 pt-32 sm:pt-36"
    >
      {/* camada 3D */}
      <div className="absolute inset-0 z-0">
        <HeroCanvas />
      </div>

      {/* leituras acima do 3D */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-40 bg-gradient-to-b from-app-bg via-app-bg/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-56 bg-gradient-to-t from-app-bg via-app-bg/85 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[48rem] w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-app-bg/60 blur-[110px] lg:h-[54rem] lg:w-[64rem]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="flex justify-center"
        >
          <span className="eyebrow">
            <Sparkles size={13} />
            IA de conteúdo para redes sociais
          </span>
        </motion.div>

        <h1 className="display mt-7 text-balance text-[clamp(2.6rem,7.4vw,5.6rem)]">
          <motion.span
            className="block text-app-text"
            initial={{ opacity: 0, y: 26, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.08, ease: EASE }}
          >
            Sua semana de conteúdo
          </motion.span>
          <motion.em
            className="mt-1 block not-italic"
            initial={{ opacity: 0, y: 26, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.22, ease: EASE }}
          >
            <span className="text-gradient text-glow italic">
              criada e agendada por IA
            </span>
          </motion.em>
        </h1>

        <motion.p
          className="mx-auto mt-7 max-w-2xl text-balance text-[1.02rem] leading-relaxed text-app-muted sm:text-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.38, ease: EASE }}
        >
          O Lumipost planeja a semana, gera posts, carrosséis e stories no tom
          da sua marca e publica direto no seu Instagram profissional.
          Você aprova. Ele publica.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
        >
          <a
            href={`${APP_URL}${REGISTER_PATH}`}
            className="btn-primary w-full sm:w-auto"
          >
            Criar minha primeira semana
            <ArrowRight size={18} />
          </a>
          <a href="#produto" className="btn-ghost w-full sm:w-auto">
            <Play size={16} />
            Ver como funciona
          </a>
        </motion.div>

        <motion.dl
          className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.04] sm:grid-cols-3"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.66, ease: EASE }}
        >
          {HERO_STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-app-bg/70 px-6 py-6 backdrop-blur-xl"
            >
              <dt className="display text-4xl text-gradient sm:text-5xl">
                {stat.value}
              </dt>
              <dd className="mt-1.5 text-xs leading-snug text-app-muted sm:text-[13px]">
                {stat.label}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>

      <motion.div
        className="absolute inset-x-0 bottom-7 z-10 flex flex-col items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-app-muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.1 }}
      >
        <MousePointerClick size={14} className="animate-scroll-hint" />
        role para ver
      </motion.div>
    </section>
  );
}
