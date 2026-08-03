"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const TEXT =
  "Postar todo dia não é falta de talento. É falta de tempo. O Lumipost devolve as suas horas e mantém a sua marca falando — com ritmo, com identidade e com aprovação sua.";

function Word({
  word,
  range,
  progress,
}: {
  word: string;
  range: [number, number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  const color = useTransform(
    progress,
    range,
    ["rgb(150,147,158)", "rgb(245,244,247)"],
  );

  return (
    <motion.span style={{ opacity, color }} className="inline-block">
      {word}
    </motion.span>
  );
}

export default function Manifesto() {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start 0.82", "end 0.55"],
  });

  const words = TEXT.split(" ");

  return (
    <section className="relative overflow-hidden py-28 sm:py-40">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-app-primary/[0.09] blur-[130px]"
      />
      <div ref={container} className="relative mx-auto max-w-4xl px-6">
        <p className="display flex flex-wrap gap-x-[0.28em] gap-y-2 text-[clamp(1.7rem,4.4vw,3.2rem)] leading-[1.22]">
          {words.map((word, index) => {
            const start = index / words.length;
            const end = start + 1 / words.length;
            return (
              <Word
                key={`${word}-${index}`}
                word={word}
                range={[start, end]}
                progress={scrollYProgress}
              />
            );
          })}
        </p>
      </div>
    </section>
  );
}
