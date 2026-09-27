"use client";

import Link from "next/link";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/app/ui/cn";

export type SpotlightSlide = {
  id: number;
  title: string;
  description: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

function isExternal(url: string) {
  return /^https?:\/\//.test(url);
}

/**
 * The hero "Spotlight": the brand video and the live admin announcements
 * (Admin → Ads & announcements, placement HOME_CAROUSEL) as one surface, the
 * way Shashtna Mobile presents its spotlight. The video is the optimised web
 * cut; it does not autoplay for people who prefer reduced motion, and the
 * announcements only rotate on their own when motion is allowed.
 */
export function HomeSpotlight({
  slides,
  labels,
}: {
  slides: SpotlightSlide[];
  labels: { video: string; region: string; previous: string; next: string; play: string; pause: string; brand: string };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [hold, setHold] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [playing, setPlaying] = useState(true);
  const count = slides.length;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(query.matches);

      if (query.matches) {
        videoRef.current?.pause();
      }
    };

    apply();
    query.addEventListener("change", apply);

    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (count < 2 || hold || reduced) {
      return;
    }

    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 7000);

    return () => window.clearInterval(timer);
  }, [count, hold, reduced]);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  const toggleVideo = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  return (
    <div
      className="relative mx-auto w-full max-w-xl"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
    >
      <div aria-hidden className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(25_81_252/0.35),transparent)]" />

      <div className="glass-soft relative rounded-[2rem] p-2 shadow-float">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-canvas">
          <video
            ref={videoRef}
            className="block aspect-[16/10] w-full object-cover"
            src="/videos/shashtna-ad-web.mp4"
            poster="/videos/shashtna-ad-poster.jpg"
            autoPlay={!reduced}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={labels.video}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/10 to-transparent" />

          <button
            type="button"
            onClick={toggleVideo}
            aria-label={playing ? labels.pause : labels.play}
            className="glass-soft absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-white/15"
          >
            {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
          </button>
        </div>

        {/* The live announcement, floating over the lower edge of the video. */}
        <section
          aria-roledescription={count > 1 ? "carousel" : undefined}
          aria-label={labels.region}
          className="relative -mt-16 px-3 pb-3 sm:-mt-20 sm:px-4 sm:pb-4"
        >
          <div className="glass rounded-[1.35rem] p-4 sm:p-5" aria-live={hold || reduced ? "polite" : "off"}>
            {count ? (
              slides.map((item, slideIndex) => (
                <div
                  key={item.id}
                  hidden={slideIndex !== index}
                  className="animate-fade-in"
                  aria-roledescription="slide"
                  aria-label={`${slideIndex + 1} / ${count}`}
                >
                  <p className="line-clamp-2 text-base font-bold leading-7 text-ink sm:text-lg">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-2">{item.description}</p>
                  ) : null}
                  {item.ctaUrl && item.ctaLabel ? (
                    isExternal(item.ctaUrl) ? (
                      <a
                        href={item.ctaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-glow hover:text-white"
                      >
                        {item.ctaLabel}
                        <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
                      </a>
                    ) : (
                      <Link href={item.ctaUrl} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-glow hover:text-white">
                        {item.ctaLabel}
                        <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
                      </Link>
                    )
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold leading-7 text-ink-2">{labels.brand}</p>
            )}

            {count > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex gap-1.5">
                  {slides.map((item, slideIndex) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(slideIndex)}
                      aria-label={`${slideIndex + 1} / ${count}`}
                      aria-current={slideIndex === index}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        slideIndex === index ? "w-6 bg-glow" : "w-1.5 bg-white/25 hover:bg-white/40",
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    aria-label={labels.previous}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-ink-2 transition hover:text-ink"
                  >
                    <ArrowLeft size={14} className="rotate-180 ltr:rotate-0" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    aria-label={labels.next}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-ink-2 transition hover:text-ink"
                  >
                    <ArrowLeft size={14} className="ltr:rotate-180" aria-hidden />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
