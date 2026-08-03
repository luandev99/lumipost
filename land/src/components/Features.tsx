"use client";

import {
  CalendarDays,
  Layers,
  Library,
  Palette,
  ShieldCheck,
  WandSparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Reveal, { RevealText, RevealWords } from "./ui/Reveal";
import { FEATURES } from "@/lib/content";

const ICONS: Record<string, LucideIcon> = {
  wand: WandSparkles,
  palette: Palette,
  layers: Layers,
  calendar: CalendarDays,
  library: Library,
  wallet: Wallet,
  shield: ShieldCheck,
};

export default function Features() {
  return (
    <section id="recursos" className="relative overflow-hidden py-28 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-app-primary/10 blur-[140px]"
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <Reveal>
            <span className="eyebrow">Recursos</span>
          </Reveal>
          <h2 className="display mt-6 text-[clamp(2.2rem,5.4vw,4rem)]">
            <RevealWords text="Tudo o que o seu social media faria —" />{" "}
            <RevealText className="text-gradient italic" delay={0.34}>
              em um app só.
            </RevealText>
          </h2>
          <Reveal delay={0.2}>
            <p className="mt-6 text-base leading-relaxed text-app-muted">
              Planejamento, geração, aprovação, agendamento e publicação no mesmo
              fluxo. Sem planilha, sem lembrete no celular, sem post esquecido.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = ICONS[feature.icon] ?? WandSparkles;
            return (
              <motion.article
                key={feature.title}
                className={`glass-panel group relative overflow-hidden rounded-3xl p-7 ${feature.span}`}
                initial={{ opacity: 0, y: 34, filter: "blur(12px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-8% 0px" }}
                transition={{
                  duration: 0.8,
                  delay: (index % 3) * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-app-primary/15 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                />
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-app-primary/12 text-app-primary ring-1 ring-app-primary/20 transition-transform duration-500 group-hover:-translate-y-0.5">
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-app-muted">
                  {feature.body}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
