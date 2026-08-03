"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { APP_URL, REGISTER_PATH } from "@/lib/content";

export default function FinalCta() {
  return (
    <section className="relative overflow-hidden px-6 pb-28 pt-10 sm:pb-36">
      <motion.div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-app-primary/20 px-6 py-20 text-center sm:px-14 sm:py-28"
        initial={{ opacity: 0, y: 40, filter: "blur(14px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background:
            "radial-gradient(120% 140% at 50% -20%, rgba(124,58,237,0.42), rgba(9,9,11,0.9) 58%, #08080a 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-app-accent/20 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full bg-app-primary/25 blur-[110px]"
        />

        <Image
          src="/assets/logo.png"
          alt=""
          width={72}
          height={72}
          className="animate-float relative mx-auto h-16 w-16 object-contain drop-shadow-[0_0_36px_rgba(169,112,255,0.55)]"
        />

        <h2 className="display relative mt-8 text-[clamp(2.3rem,6vw,4.4rem)]">
          Sua próxima semana
          <br />
          <span className="text-gradient text-glow italic">
            já pode estar pronta.
          </span>
        </h2>

        <p className="relative mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-app-muted">
          Conecte seu Instagram, descreva sua marca e deixe o Lumipost cuidar
          do resto. Você continua no controle de cada publicação.
        </p>

        <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={`${APP_URL}${REGISTER_PATH}`} className="btn-primary w-full sm:w-auto">
            Começar agora
            <ArrowRight size={18} />
          </a>
          <a href="#planos" className="btn-ghost w-full sm:w-auto">
            Ver planos
          </a>
        </div>

        <p className="relative mt-6 text-xs text-app-muted/70">
          Sem cartão para explorar · Cancele quando quiser
        </p>
      </motion.div>
    </section>
  );
}
