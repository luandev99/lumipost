"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import BrandMark from "./ui/BrandMark";
import { APP_URL, LOGIN_PATH, NAV_LINKS, REGISTER_PATH } from "@/lib/content";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.001,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.div
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-app-primary via-app-accent to-app-primary"
        style={{ scaleX: progress }}
      />

      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 transition-all duration-500 sm:px-5 ${
            scrolled ? "glass-nav" : "border border-transparent"
          }`}
        >
          <a href="#topo" aria-label="lumipost — início">
            <BrandMark compact />
          </a>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative rounded-full px-4 py-2 text-sm font-medium text-app-muted transition-colors hover:text-app-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 lg:flex">
            <a
              href={`${APP_URL}${LOGIN_PATH}`}
              className="rounded-full px-4 py-2 text-sm font-semibold text-app-muted transition-colors hover:text-app-text"
            >
              Acessar
            </a>
            <a
              href={`${APP_URL}${REGISTER_PATH}`}
              className="btn-primary !min-h-0 !px-5 !py-2.5 text-sm"
            >
              Começar agora
              <ArrowUpRight size={16} />
            </a>
          </div>

          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-app-text lg:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col justify-center gap-2 bg-app-bg/95 px-8 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {NAV_LINKS.map((link, index) => (
              <motion.a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="display border-b border-white/5 py-4 text-4xl text-app-text"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * index, duration: 0.5 }}
              >
                {link.label}
              </motion.a>
            ))}
            <motion.a
              href={`${APP_URL}${REGISTER_PATH}`}
              className="btn-primary mt-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.5 }}
            >
              Começar agora
              <ArrowUpRight size={18} />
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
