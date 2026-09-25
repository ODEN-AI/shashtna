"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "./cn";

export type Slide = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  style: string;
};

const STYLE_BG: Record<string, string> = {
  STANDARD: "from-[#0f2a6b] via-[#0b1733] to-[#070d1c]",
  HIGHLIGHT: "from-[#1d4fd8] via-[#10256a] to-[#070d1c]",
  INFO: "from-[#0c3a52] via-[#0b1d33] to-[#070d1c]",
  WARNING: "from-[#4a3208] via-[#1f1a10] to-[#070d1c]",
};

function isExternal(url: string) {
  return /^https?:\/\//.test(url);
}

/** Admin-managed ads / announcements (Admin → Ads & announcements). */
export function AnnouncementCarousel({
  slides,
  label,
  previousLabel,
  nextLabel,
}: {
  slides: Slide[];
  label: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || reduced.current) {
      return;
    }

    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 7000);

    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (!count) {
    return null;
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-panel border border-line">
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          const cta = slide.ctaUrl && slide.ctaLabel ? slide : null;

          return (
            <article
              key={slide.id}
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} / ${count}`}
              aria-hidden={!active}
              className={cn(
                "grid min-h-[220px] items-end bg-gradient-to-br transition-opacity duration-700 sm:min-h-[260px]",
                STYLE_BG[slide.style] ?? STYLE_BG.STANDARD,
                active ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0",
              )}
            >
              {slide.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.imageUrl}
                  alt=""
                  loading={slideIndex === 0 ? "eager" : "lazy"}
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050a14] via-[#050a14]/40 to-transparent" />
              <div className="relative p-6 sm:p-9">
                <h3 className="max-w-xl text-balance text-xl font-bold text-white sm:text-2xl">{slide.title}</h3>
                {slide.description ? (
                  <p className="mt-2 max-w-xl text-sm leading-7 text-white/75">{slide.description}</p>
                ) : null}
                {cta ? (
                  isExternal(cta.ctaUrl!) ? (
                    <a
                      href={cta.ctaUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      tabIndex={active ? 0 : -1}
                      className="mt-5 inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-bold text-canvas transition hover:bg-brand-ink"
                    >
                      {cta.ctaLabel}
                    </a>
                  ) : (
                    <Link
                      href={cta.ctaUrl!}
                      tabIndex={active ? 0 : -1}
                      className="mt-5 inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-bold text-canvas transition hover:bg-brand-ink"
                    >
                      {cta.ctaLabel}
                    </Link>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {count > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={previousLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-2 hover:text-ink"
          >
            <ChevronRight size={16} className="ltr:rotate-180" aria-hidden />
          </button>
          <div className="flex gap-1.5">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(slideIndex)}
                aria-label={`${slideIndex + 1}`}
                aria-current={slideIndex === index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  slideIndex === index ? "w-6 bg-glow" : "w-1.5 bg-line-strong",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={nextLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-2 hover:text-ink"
          >
            <ChevronLeft size={16} className="ltr:rotate-180" aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}
