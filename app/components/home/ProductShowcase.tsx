"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { distinctLines, repeatsDuration } from "@/app/ui/catalogue-text";
import { cn } from "@/app/ui/cn";
import { ProductEmblem } from "@/app/ui/product/Product";
import type { ShowcaseScene } from "@/src/server/promotions";

const OUT_MS = 950;

// Flat service fields: IPTV cobalt, VIP and its devices warm black, the
// player on the deep brand blue. No glows or orbs.
const BACKDROP: Record<ShowcaseScene["kind"], string> = {
  iptv: "bg-iptv",
  vip: "bg-vip-field",
  device: "bg-vip-soft",
  player: "bg-iptv-deep",
};

const IS_VIP: Record<ShowcaseScene["kind"], boolean> = { iptv: false, vip: true, device: true, player: false };

type State = "in" | "out" | "idle";

export type SceneDuration = { durationMonths: number; durationLabel: string };

/**
 * Shashtna Product Showcase — hero board 1.
 *
 * Each scene is a layered composition (backdrop, product visual, headline,
 * facts, price, CTA); changing scene plays an exit choreography on the old
 * scene while the new one enters (see .sx-* in globals.css). Scenes come from
 * live catalogue data.
 *
 * Scenes never change on their own: the visitor moves between them with the
 * previous / next buttons or the scene buttons. Lines that only repeat the
 * scene's title or the package's duration are not shown twice.
 */
export function ProductShowcase({
  scenes,
  durations,
  labels,
}: {
  scenes: ShowcaseScene[];
  /** Package scenes' own duration, keyed by scene key (to drop lines that only repeat it). */
  durations?: Record<string, SceneDuration>;
  labels: { region: string; previous: string; next: string; currency: string };
}) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const count = scenes.length;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);

    apply();
    query.addEventListener("change", apply);

    return () => query.removeEventListener("change", apply);
  }, []);

  // The player scene's video only plays on screen and in the foreground tab.
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

  const go = useCallback(
    (next: number) => {
      setIndex((current) => {
        const target = ((next % count) + count) % count;

        if (target !== current) {
          setPrevious(current);
        }

        return target;
      });
    },
    [count],
  );

  // Park the scene that just left once its exit choreography has finished.
  useEffect(() => {
    if (previous === null) {
      return;
    }

    const timer = window.setTimeout(() => setPrevious(null), OUT_MS);

    return () => window.clearTimeout(timer);
  }, [previous, index]);

  // Only the active scene's video plays, and never under reduced motion.
  useEffect(() => {
    videoRefs.current.forEach((video, key) => {
      if (key === scenes[index]?.key && visible && !reduced) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [index, visible, reduced, scenes]);

  if (!count) {
    return null;
  }

  const stateOf = (sceneIndex: number): State => (sceneIndex === index ? "in" : sceneIndex === previous ? "out" : "idle");

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label={labels.region}
      data-testid="product-showcase"
      data-scene={scenes[index].key}
      className="relative isolate h-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-canvas sm:h-[540px] lg:h-full lg:min-h-[520px]"
      onKeyDown={(event) => {
        if (count < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        // Arrow keys follow the reading direction: in RTL, left is "next".
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        go(index + ((event.key === "ArrowLeft") === rtl ? 1 : -1));
      }}
    >
      {scenes.map((scene, sceneIndex) => {
        const state = stateOf(sceneIndex);
        const words = scene.title.split(/\s+/).filter(Boolean);
        const vip = IS_VIP[scene.kind];
        // A line that only repeats the duration is dropped only when the title
        // already shows that duration ("IPTV 12 شهرًا"); for "VIP بريميوم" the
        // duration line is the only place it appears, so it stays.
        const duration = durations?.[scene.key];
        const titleShowsDuration = duration ? repeatsDuration(scene.title, duration) : false;
        const kept = new Set(distinctLines([scene.subtitle, ...scene.facts, ...scene.chips], scene.title, titleShowsDuration ? duration : undefined));
        const subtitle = scene.subtitle && kept.has(scene.subtitle.trim()) ? scene.subtitle : null;
        const facts = scene.facts.filter((fact) => kept.has(fact.trim())).slice(0, 3);
        const chips = scene.chips.filter((chip) => kept.has(chip.trim()) && !facts.includes(chip)).slice(0, 2);

        return (
          <div
            key={scene.key}
            className="sx-scene"
            data-state={state}
            data-kind={scene.kind}
            aria-hidden={state !== "in"}
            inert={state !== "in"}
            aria-roledescription="slide"
            aria-label={`${sceneIndex + 1} / ${count}: ${scene.title}`}
          >
            <div className={cn("sx-layer sx-bg absolute inset-0", BACKDROP[scene.kind])} />

            <div className="relative grid h-full grid-rows-[42%_1fr] lg:grid-cols-[1fr_1.05fr] lg:grid-rows-1">
              {/* Product visual (end side on desktop, top on phones) */}
              <div className="relative flex items-center justify-center p-6 lg:order-2 lg:p-10">
                <div className="sx-layer sx-visual relative flex h-full w-full items-center justify-center">
                  <SceneVisual
                    scene={scene}
                    registerVideo={(node) => {
                      if (node) videoRefs.current.set(scene.key, node);
                      else videoRefs.current.delete(scene.key);
                    }}
                  />
                </div>
                {chips.map((chip, chipIndex) => (
                  <span
                    key={chip}
                    className={cn(
                      "sx-layer sx-rise glass-soft absolute flex items-center rounded-full px-3 py-1.5 text-xs font-bold",
                      vip ? "text-vip" : "text-white",
                      chipIndex === 0 ? "end-[8%] top-[10%] lg:end-[10%] lg:top-[14%]" : "bottom-[8%] start-[8%] lg:bottom-[16%] lg:start-[4%]",
                    )}
                    style={{ "--i": chipIndex } as CSSProperties}
                  >
                    <bdi className="max-w-40 truncate">{chip}</bdi>
                  </span>
                ))}
              </div>

              {/* Copy */}
              <div className="relative flex flex-col justify-end gap-4 px-6 pb-20 pt-2 sm:px-8 lg:order-1 lg:justify-center lg:pb-20 lg:ps-10 lg:pt-10">
                <p
                  className={cn("sx-layer sx-rise w-fit rounded-full px-3 py-1 text-xs font-bold", vip ? "bg-vip text-vip-ink" : "bg-white text-iptv-deep")}
                  style={{ "--i": -3 } as CSSProperties}
                >
                  {scene.eyebrow}
                </p>
                <h3 dir="auto" className={cn("text-balance text-3xl font-bold leading-[1.2] sm:text-4xl lg:text-[2.3rem]", vip ? "text-vip" : "text-white")}>
                  {words.map((word, wordIndex) => (
                    <Fragment key={`${word}-${wordIndex}`}>
                      <span className="sx-mask">
                        <span className="sx-layer sx-text" style={{ "--i": wordIndex } as CSSProperties}>
                          {word}
                        </span>
                      </span>
                      {wordIndex < words.length - 1 ? " " : null}
                    </Fragment>
                  ))}
                </h3>
                {subtitle ? (
                  <p
                    dir="auto"
                    className={cn("sx-layer sx-rise line-clamp-2 max-w-md text-sm leading-7 sm:text-[15px]", vip ? "text-vip-text" : "text-iptv-ink")}
                    style={{ "--i": -1 } as CSSProperties}
                  >
                    {subtitle}
                  </p>
                ) : null}
                {facts.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {facts.map((fact, factIndex) => (
                      <li
                        key={fact}
                        dir="auto"
                        className={cn("sx-layer sx-rise glass-soft rounded-xl px-3 py-2 text-xs font-semibold", vip ? "text-vip" : "text-white")}
                        style={{ "--i": factIndex } as CSSProperties}
                      >
                        {fact}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="sx-layer sx-rise flex flex-wrap items-center gap-4 pt-1" style={{ "--i": 3.5 } as CSSProperties}>
                  {scene.price !== null ? (
                    <div>
                      <p className={cn("flex items-baseline gap-1.5", vip ? "text-vip" : "text-white")}>
                        <span className="nums text-3xl font-bold tracking-tight" dir="ltr">
                          {new Intl.NumberFormat("en-US").format(scene.price)}
                        </span>
                        <span className={cn("text-xs font-semibold", vip ? "text-vip-text" : "text-iptv-ink")}>{labels.currency}</span>
                      </p>
                      {scene.priceNote ? <p className={cn("nums text-xs", vip ? "text-vip-text" : "text-iptv-ink")}>{scene.priceNote}</p> : null}
                    </div>
                  ) : null}
                  <Link
                    href={scene.cta.href}
                    data-testid="showcase-cta"
                    className={cn(
                      "group/cta inline-flex h-12 items-center gap-3 whitespace-nowrap rounded-2xl pe-1.5 ps-5 text-sm font-bold transition-colors",
                      vip ? "bg-vip text-vip-ink hover:brightness-105" : "bg-white text-iptv-deep hover:bg-iptv-ink",
                    )}
                  >
                    {scene.cta.label}
                    <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white", vip ? "bg-vip-field" : "bg-iptv-deep")}>
                      <ArrowLeft size={16} className="ltr:rotate-180" />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Scene buttons + previous / next (persistent layer) */}
      {count > 1 ? (
        <div className="absolute inset-x-5 bottom-5 z-10 flex items-center gap-3 sm:inset-x-8 lg:ps-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={labels.previous}
            data-testid="showcase-previous"
            className="glass-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <ChevronRight size={18} className="ltr:rotate-180" aria-hidden />
          </button>
          <div className="flex flex-1 gap-1.5" role="group" aria-label={labels.region}>
            {scenes.map((scene, sceneIndex) => (
              <button
                key={scene.key}
                type="button"
                onClick={() => go(sceneIndex)}
                aria-label={`${sceneIndex + 1} / ${count}: ${scene.title}`}
                aria-current={sceneIndex === index}
                data-testid="showcase-scene-button"
                className="group/seg relative h-10 flex-1"
              >
                <span
                  className={cn(
                    "absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full transition-colors",
                    sceneIndex === index ? "bg-white" : "bg-white/25 group-hover/seg:bg-white/45",
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={labels.next}
            data-testid="showcase-next"
            className="glass-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <ChevronLeft size={18} className="ltr:rotate-180" aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SceneVisual({ scene, registerVideo }: { scene: ShowcaseScene; registerVideo: (node: HTMLVideoElement | null) => void }) {
  if (scene.video) {
    return (
      <div className="relative w-full max-w-[26rem]">
        <div className="rounded-[1.4rem] border border-white/15 bg-canvas/80 p-1.5">
          <video
            ref={registerVideo}
            className="block aspect-video w-full rounded-[1.05rem] object-cover"
            src={scene.video.src}
            poster={scene.video.poster}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            tabIndex={-1}
          />
        </div>
        <div aria-hidden className="mx-auto h-2.5 w-28 rounded-b-xl bg-white/15" />
      </div>
    );
  }

  if (scene.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={scene.imageUrl} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full rounded-[1.6rem] object-contain" />
    );
  }

  return <ProductEmblem kind={scene.kind} className="w-32 sm:w-40 lg:w-48" />;
}
