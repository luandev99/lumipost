"use client";

import { ArrowRight, Check, Zap } from "lucide-react";
import { motion } from "motion/react";
import Reveal, { RevealText, RevealWords } from "./ui/Reveal";
import { APP_URL, CREDIT_PACKAGES, PLANS, REGISTER_PATH } from "@/lib/content";

export default function Pricing() {
  return (
    <section id="planos" className="relative overflow-hidden py-28 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[26rem] w-[46rem] -translate-x-1/2 rounded-full bg-app-primary/[0.12] blur-[130px]"
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">Planos</span>
          </Reveal>
          <h2 className="display mt-6 text-[clamp(2.2rem,5.4vw,4rem)]">
            <RevealWords text="Preço claro," />{" "}
            <RevealText className="text-gradient italic" delay={0.22}>
              crédito que não some.
            </RevealText>
          </h2>
          <Reveal delay={0.2}>
            <p className="mt-6 text-base leading-relaxed text-app-muted">
              Você vê o extrato de cada geração e de cada agendamento. Agendamento
              manual custa 2 créditos, cobrados uma única vez.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          {PLANS.map((plan, index) => (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 36, filter: "blur(12px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{
                duration: 0.85,
                delay: index * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`relative overflow-hidden rounded-[2rem] p-8 sm:p-10 ${
                plan.featured
                  ? "border border-app-primary/35 bg-gradient-to-b from-app-primary/[0.14] to-app-bg"
                  : "glass-panel"
              }`}
            >
              {plan.featured && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-app-primary/25 blur-[90px]"
                />
              )}

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-app-muted">{plan.credits}</p>
                </div>
                {plan.badge && (
                  <span className="shrink-0 rounded-full bg-app-primary/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-app-primary ring-1 ring-app-primary/25">
                    {plan.badge}
                  </span>
                )}
              </div>

              <p className="relative mt-8 flex items-baseline gap-1.5">
                <span className="display text-6xl text-app-text sm:text-7xl">
                  {plan.price}
                </span>
                <span className="text-sm font-medium text-app-muted">
                  {plan.period}
                </span>
              </p>

              <ul className="relative mt-8 space-y-3.5">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-app-primary/15 text-app-primary">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="text-app-muted">{perk}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`${APP_URL}${REGISTER_PATH}?plano=${plan.id}`}
                className={`relative mt-10 w-full ${plan.featured ? "btn-primary" : "btn-ghost"}`}
              >
                Assinar {plan.name}
                <ArrowRight size={17} />
              </a>
            </motion.article>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="glass-panel mt-5 rounded-[2rem] p-8 sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primary/12 text-app-primary ring-1 ring-app-primary/20">
                <Zap size={16} />
              </span>
              <h3 className="text-lg font-bold tracking-tight">
                Acabou o crédito no meio da semana?
              </h3>
              <span className="text-sm text-app-muted">
                Compre um pacote avulso — sem mudar de plano.
              </span>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {CREDIT_PACKAGES.map((pack) => (
                <div
                  key={pack.name}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors hover:border-app-primary/30"
                >
                  <p className="text-sm font-bold">{pack.name}</p>
                  <p className="display mt-2 text-3xl text-gradient">
                    {pack.price}
                  </p>
                  <p className="mt-2 text-xs text-app-muted">
                    {pack.credits} créditos · {pack.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
