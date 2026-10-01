"use client";

import Link from "next/link";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/app/ui/cn";
import { LogoMark } from "@/app/ui/Logo";
import { ProductEmblem } from "@/app/ui/product/Product";
import type { ShowcaseScene } from "@/src/server/promotions";

const SCENE_MS = 6500;
const OUT_MS = 950;

const BACKDROP: Record<ShowcaseScene["kind"], string> = {
  iptv: "bg-[radial-gradient(90%_70%_at_20%_0%,rgb(25_81_252/0.55),transparent_60%),linear-gradient(160deg,var(--color-brand-strong)_0%,var(--color-navy)_45%,var(--color-canvas)_100%)]",
  vip: "bg-[radial-gradient(90%_70%_at_20%_0%,rgb(75_79_224/0.6),transparent_60%),linear-gradient(160deg,var(--color-vip-2)_0%,var(--color-vip-1)_45%,var(--color-canvas)_100%)]",
  device: "bg-[radial-gradient(80%_70%_at_80%_10%,rgb(43_47_168/0.6),transparent_60%),linear-gradient(200deg,var(--color-vip-1)_0%,var(--color-navy)_50%,var(--color-canvas)_100%)]",
  player: "bg-[radial-gradient(90%_70%_at_25%_10%,rgb(55_129_252/0.5),transparent_60%),linear-gradient(180deg,var(--color-navy)_0%,#04123f_50%,var(--color-canvas)_100%)]",
};

const ORBS: Record<ShowcaseScene["kind"], [string, string]> = {
  iptv: ["top-[-12%] end-[-8%] h-72 w-72 bg-[radial-gradient(closest-side,rgb(55_129_252/0.55),transparent)]", "bottom-[-18%] start-[10%] h-80 w-80 bg-[radial-gradient(closest-side,rgb(203_233_253/0.18),transparent)]"],
  vip: ["top-[5%] start-[-10%] h-80 w-80 bg-[radial-gradient(closest-side,rgb(75_79_224/0.6),transparent)]", "bottom-[-20%] end-[5%] h-72 w-72 bg-[radial-gradient(closest-side,rgb(255_194_71/0.16),transparent)]"],
  device: ["top-[-15%] start-[20%] h-72 w-72 bg-[radial-gradient(closest-side,rgb(43_47_168/0.65),transparent)]", "bottom-[-10%] end-[-10%] h-96 w-96 bg-[radial-gradient(closest-side,rgb(55_129_252/0.3),transparent)]"],
  player: ["top-[10%] end-[-15%] h-96 w-96 bg-[radial-gradient(closest-side,rgb(25_81_252/0.5),transparent)]", "bottom-[-15%] start-[-5%] h-72 w-72 bg-[radial-gradient(closest-side,rgb(203_233_253/0.2),transparent)]"],
};

// Where each floating chip starts from (x is mirrored for RTL by --sx-dir).
const FLOAT_PATHS: CSSProperties[] = [
  { "--fx": "-60px", "--fy": "-30px" } as CSSProperties,
  { "--fx": "70px", "--fy": "40px" } as CSSProperties,
  { "--fx": "-40px", "--fy": "60px" } as CSSProperties,
];

type State = "in" | "out" | "idle";

/**
 * Shashtna Animated Product Showcase — hero board 1.
 *
 * Not a slider: each scene is a layered composition (backdrop, orbit ring,
 * light orbs, product visual, floating chips, kinetic headline, facts,
 * price, CTA). Changing scene plays an exit choreography on every layer of
 * the old scene while the new scene's layers enter on their own paths and
 * delays (see .sx-* in globals.css). Scenes come from live catalogue data.
 *
 * Auto-advance follows the progress bar, pauses on hover/focus, off-screen
 * and in background tabs, and is off entirely under reduced motion (scenes
 * then change only on request, without animation).
 */
export function ProductShowcase({
  scenes,
  labels,
}: {
  scenes: ShowcaseScene[];
  labels: { region: string; pause: string; play: string; scene: string; currency: string };
}) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(true);
  const count = scenes.length;
  const running = count > 1 && !reduced && !userPaused && !hover && visible;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);

    apply();
    query.addEventListener("change", apply);

    return () => query.removeEventListener("change", apply);
  }, []);

  // Pause off-screen and in background tabs (saves CPU and battery).
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
      className={cn(
        "relative isolate h-[640px] overflow-hidden rounded-[2rem] border border-white/10 bg-canvas shadow-float sm:h-[560px] lg:h-full lg:min-h-[540px]",
        !running && "sx-paused",
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
    >
      {scenes.map((scene, sceneIndex) => {
        const state = stateOf(sceneIndex);
        const words = scene.title.split(/\s+/).filter(Boolean);

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
            {/* Backdrop, orbs and orbit ring */}
            <div className={cn("sx-layer sx-bg absolute inset-0", BACKDROP[scene.kind])} />
            {ORBS[scene.kind].map((orb, orbIndex) => (
              <div key={orbIndex} aria-hidden className={cn("sx-layer sx-orb absolute rounded-full", orb)} />
            ))}
            <div
              aria-hidden
              className="sx-layer sx-ring absolute start-auto end-[-18%] top-[4%] h-[62%] w-[62%] rounded-full border border-glow/15 max-lg:end-[-20%] max-lg:top-[-6%] lg:end-[-6%] lg:top-[12%] lg:h-[78%] lg:w-[58%]"
            >
              <span className="absolute inset-[12%] rounded-full border border-glow/10" />
              <span className="absolute start-[8%] top-[18%] h-2.5 w-2.5 rounded-full bg-glow shadow-[0_0_18px_rgb(203_233_253/0.9)]" />
            </div>

            <div className="relative grid h-full grid-rows-[46%_1fr] lg:grid-cols-[1fr_1.05fr] lg:grid-rows-1">
              {/* Product visual (end side on desktop, top on phones) */}
              <div className="relative flex items-center justify-center p-6 lg:order-2 lg:p-10">
                <div className="sx-layer sx-visual relative flex h-full w-full items-center justify-center">
                  <div className="sx-drift relative flex h-full w-full items-center justify-center">
                    <SceneVisual
                      scene={scene}
                      registerVideo={(node) => {
                        if (node) videoRefs.current.set(scene.key, node);
                        else videoRefs.current.delete(scene.key);
                      }}
                    />
                  </div>
                </div>
                {[...scene.chips.slice(0, 2), ...(scene.kind === "player" ? [] : ["__mark"])].map((chip, chipIndex) => (
                  <span
                    key={chip}
                    className={cn(
                      "sx-layer sx-float glass-soft absolute flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-card",
                      chipIndex === 0 && "end-[8%] top-[12%] lg:end-[10%] lg:top-[16%]",
                      chipIndex === 1 && "bottom-[10%] start-[8%] lg:bottom-[18%] lg:start-[4%]",
                      chipIndex === 2 && "bottom-[16%] end-[10%] lg:bottom-[12%] lg:end-[14%]",
                    )}
                    style={{ ...FLOAT_PATHS[chipIndex], "--i": chipIndex } as CSSProperties}
                  >
                    {chip === "__mark" ? (
                      <>
                        <LogoMark className="h-5 w-5" />
                        {labels.scene}
                      </>
                    ) : (
                      <span className="max-w-40 truncate">{chip}</span>
                    )}
                  </span>
                ))}
              </div>

              {/* Copy */}
              <div className="relative flex flex-col justify-end gap-4 px-6 pb-16 pt-2 sm:px-8 lg:order-1 lg:justify-center lg:pb-20 lg:ps-10 lg:pt-10">
                <p className="sx-layer sx-rise w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-navy" style={{ "--i": -3 } as CSSProperties}>
                  {scene.eyebrow}
                </p>
                <h3 className="text-balance text-3xl font-bold leading-[1.2] text-white sm:text-4xl lg:text-[2.3rem]">
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
                {scene.subtitle ? (
                  <p className="sx-layer sx-rise line-clamp-2 max-w-md text-sm leading-7 text-glow/90 sm:text-[15px]" style={{ "--i": -1 } as CSSProperties}>
                    {scene.subtitle}
                  </p>
                ) : null}
                {scene.facts.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {scene.facts.slice(0, 3).map((fact, factIndex) => (
                      <li
                        key={fact}
                        className="sx-layer sx-rise glass-soft rounded-xl px-3 py-2 text-xs font-semibold text-white"
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
                      <p className="flex items-baseline gap-1.5 text-white">
                        <span className="nums text-3xl font-bold tracking-tight" dir="ltr">
                          {new Intl.NumberFormat("en-US").format(scene.price)}
                        </span>
                        <span className="text-xs font-semibold text-glow/80">{labels.currency}</span>
                      </p>
                      {scene.priceNote ? <p className="nums text-xs text-glow/75">{scene.priceNote}</p> : null}
                    </div>
                  ) : null}
                  <Link
                    href={scene.cta.href}
                    data-testid="showcase-cta"
                    className="group/cta inline-flex h-12 items-center gap-3 whitespace-nowrap rounded-2xl bg-white pe-1.5 ps-5 text-sm font-bold text-navy shadow-glow transition hover:bg-glow"
                  >
                    {scene.cta.label}
                    <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white">
                      <ArrowLeft size={16} className="ltr:rotate-180" />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Scene timeline + pause (persistent layer) */}
      {count > 1 ? (
        <div className="absolute inset-x-5 bottom-5 z-10 flex items-center gap-3 sm:inset-x-8 lg:ps-2">
          <div className="flex flex-1 gap-1.5" role="group" aria-label={labels.region}>
            {scenes.map((scene, sceneIndex) => (
              <button
                key={scene.key}
                type="button"
                onClick={() => go(sceneIndex)}
                aria-label={`${sceneIndex + 1} / ${count}: ${scene.title}`}
                aria-current={sceneIndex === index}
                className="group/seg relative h-6 flex-1"
              >
                <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition group-hover/seg:bg-white/35">
                  {sceneIndex < index ? <span className="absolute inset-0 bg-white/70" /> : null}
                  {sceneIndex === index ? (
                    reduced ? (
                      <span className="absolute inset-0 bg-white" />
                    ) : (
                      <span
                        key={index}
                        className="sx-progress absolute inset-0 bg-white"
                        style={{ "--sx-duration": `${SCENE_MS}ms` } as CSSProperties}
                        onAnimationEnd={() => go(index + 1)}
                      />
                    )
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setUserPaused((value) => !value)}
            aria-label={userPaused ? labels.play : labels.pause}
            className="glass-soft flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15"
          >
            {userPaused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
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
        <div className="rounded-[1.4rem] border border-white/15 bg-canvas/80 p-1.5 shadow-[0_30px_80px_-30px_rgb(25_81_252/0.8)]">
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
      <img
        src={scene.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="max-h-full max-w-full rounded-[1.6rem] object-contain drop-shadow-[0_30px_50px_rgb(1_5_22/0.6)]"
      />
    );
  }

  return <ProductEmblem kind={scene.kind} className="w-40 sm:w-48 lg:w-56" />;
}
