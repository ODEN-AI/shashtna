"use client";

import Link from "next/link";
import { ArrowLeft, Megaphone, Newspaper, Sparkles, Tag } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/app/ui/cn";
import type { EditorialItem } from "@/src/server/promotions";

const BOARD_MS = 7000;

const KIND_ICON: Record<string, typeof Tag> = { AD: Megaphone, OFFER: Tag, NEWS: Newspaper, ANNOUNCEMENT: Sparkles };

function isExternal(url: string) {
  return /^https?:\/\//.test(url);
}

/**
 * Hero board 2 — the editorial board for ads, offers, news and announcements
 * published from Admin → Ads & announcements (placement "Homepage hero").
 * Media is the admin's image or video (video: muted, looping, poster first,
 * only the visible item plays, never under reduced motion, falls back to the
 * poster if it cannot play). The box has a fixed size, so nothing shifts.
 */
export function EditorialBoard({
  items,
  labels,
}: {
  items: EditorialItem[];
  labels: { region: string; kinds: Record<string, string>; previous: string; next: string };
}) {
  const rootRef = useRef<HTMLElement>(null);
  const videos = useRef(new Map<number, HTMLVideoElement>());
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [hold, setHold] = useState(false);
  const [visible, setVisible] = useState(true);
  const [broken, setBroken] = useState<Set<number>>(() => new Set());
  const count = items.length;
  const running = count > 1 && !reduced && !hold && visible;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);

    apply();
    query.addEventListener("change", apply);

    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    let onScreen = true;
    const update = () => setVisible(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });

    if (node) observer.observe(node);
    document.addEventListener("visibilitychange", update);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    videos.current.forEach((video, id) => {
      if (id === items[index]?.id && visible && !reduced) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [index, visible, reduced, items]);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  if (!count) {
    return null;
  }

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label={labels.region}
      data-testid="editorial-board"
      className={cn(
        "relative isolate h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-surface shadow-float sm:h-[540px] lg:h-full lg:min-h-[540px]",
        !running && "sx-paused",
      )}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
    >
      {items.map((item, itemIndex) => {
        const active = itemIndex === index;
        const Icon = KIND_ICON[item.kind] ?? Megaphone;
        const showVideo = item.mediaType === "VIDEO" && item.videoUrl && !broken.has(item.id);

        return (
          <article
            key={item.id}
            data-testid="editorial-item"
            data-media={showVideo ? "video" : item.imageUrl ? "image" : "none"}
            aria-hidden={!active}
            inert={!active}
            aria-roledescription="slide"
            aria-label={`${itemIndex + 1} / ${count}`}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              active ? "z-[1] opacity-100" : "opacity-0",
            )}
          >
            {/* Media */}
            <div className={cn("absolute inset-0 overflow-hidden transition-transform duration-[7000ms] ease-linear", active && !reduced ? "scale-[1.06]" : "scale-100")}>
              {showVideo ? (
                <video
                  ref={(node) => {
                    if (node) videos.current.set(item.id, node);
                    else videos.current.delete(item.id);
                  }}
                  className="h-full w-full object-cover"
                  src={item.videoUrl!}
                  poster={item.imageUrl ?? undefined}
                  muted
                  loop
                  playsInline
                  preload={active ? "metadata" : "none"}
                  aria-hidden
                  tabIndex={-1}
                  onError={() => setBroken((current) => new Set(current).add(item.id))}
                />
              ) : item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" loading={itemIndex === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-brand-band" />
              )}
            </div>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-canvas/5" />

            {/* Editorial copy */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 pb-16 sm:p-8 sm:pb-16">
              <p className={cn("flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-navy transition duration-700", active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
                <Icon size={13} aria-hidden />
                {labels.kinds[item.kind] ?? labels.kinds.AD}
              </p>
              <h3
                className={cn(
                  "text-balance text-2xl font-bold leading-snug text-white transition duration-700 [transition-delay:120ms] sm:text-[1.9rem]",
                  active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
              >
                {item.title}
              </h3>
              {item.description ? (
                <p className={cn("line-clamp-2 max-w-md text-sm leading-7 text-ink-2 transition duration-700 [transition-delay:200ms]", active ? "opacity-100" : "opacity-0")}>
                  {item.description}
                </p>
              ) : null}
              <div className={cn("flex flex-wrap items-center gap-3 pt-1 transition duration-700 [transition-delay:280ms]", active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
                {item.highlight ? (
                  <span className="nums rounded-xl border border-glow/30 bg-glow/10 px-3 py-2 text-sm font-bold text-glow">{item.highlight}</span>
                ) : null}
                {item.cta ? (
                  isExternal(item.cta.href) ? (
                    <a
                      href={item.cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-brand transition hover:bg-brand-strong"
                    >
                      {item.cta.label}
                      <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      href={item.cta.href}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-brand transition hover:bg-brand-strong"
                    >
                      {item.cta.label}
                      <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
                    </Link>
                  )
                ) : null}
              </div>
            </div>
          </article>
        );
      })}

      {/* Counter + timeline */}
      <div className="absolute inset-x-6 top-5 z-10 flex items-center justify-between sm:inset-x-8">
        <span className="glass-soft nums rounded-full px-3 py-1 text-xs font-bold text-white" dir="ltr">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
      </div>
      {count > 1 ? (
        <div className="absolute inset-x-6 bottom-5 z-10 flex gap-1.5 sm:inset-x-8" role="group" aria-label={labels.region}>
          {items.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(itemIndex)}
              aria-label={`${itemIndex + 1} / ${count}: ${item.title}`}
              aria-current={itemIndex === index}
              className="group/seg relative h-6 flex-1"
            >
              <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 group-hover/seg:bg-white/35">
                {itemIndex === index ? (
                  reduced ? (
                    <span className="absolute inset-0 bg-white" />
                  ) : (
                    <span
                      key={index}
                      className="sx-progress absolute inset-0 bg-white"
                      style={{ "--sx-duration": `${BOARD_MS}ms` } as CSSProperties}
                      onAnimationEnd={() => go(index + 1)}
                    />
                  )
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
