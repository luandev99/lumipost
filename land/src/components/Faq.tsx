"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import Reveal, { RevealText, RevealWords } from "./ui/Reveal";
import { FAQ } from "@/lib/content";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-28 sm:py-36">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal>
            <span className="eyebrow">Dúvidas</span>
          </Reveal>
          <h2 className="display mt-6 text-[clamp(2.2rem,5.4vw,3.6rem)]">
            <RevealWords text="Antes de" />{" "}
            <RevealText className="text-gradient italic" delay={0.18}>
              começar.
            </RevealText>
          </h2>
          <Reveal delay={0.18}>
            <p className="mt-5 text-sm leading-relaxed text-app-muted">
              Ainda ficou algo no ar? Fale com a gente em{" "}
              <a
                href="mailto:contato@lumipost.com.br"
                className="font-semibold text-app-primary underline-offset-4 hover:underline"
              >
                contato@lumipost.com.br
              </a>
              .
            </p>
          </Reveal>
        </div>

        <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {FAQ.map((item, index) => {
            const isOpen = open === index;
            return (
              <motion.li
                key={item.q}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-6% 0px" }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span
                    className={`text-base font-semibold transition-colors sm:text-lg ${
                      isOpen ? "text-app-primary" : "text-app-text"
                    }`}
                  >
                    {item.q}
                  </span>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
                      isOpen
                        ? "rotate-45 border-app-primary/40 bg-app-primary/15 text-app-primary"
                        : "border-white/10 text-app-muted"
                    }`}
                  >
                    <Plus size={15} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-7 text-sm leading-relaxed text-app-muted">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
