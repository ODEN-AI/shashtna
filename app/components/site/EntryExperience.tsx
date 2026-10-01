"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarClock, CreditCard, Megaphone, MonitorPlay, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { cn } from "@/app/ui/cn";
import { ProductEmblem, type ProductKind } from "@/app/ui/product/Product";
import { isQuietPath, planEntry, sanitizeHistory, type EntryItem, type EntryPayload } from "@/src/lib/promotions";

/** Session guard: one entry experience per browser session. */
export const ENTRY_SESSION_KEY = "shashtna.entry.session";
/** Rotation memory across sessions (least recently shown first). */
export const ENTRY_HISTORY_KEY = "shashtna.entry.history";

type Plan = NonNullable<ReturnType<typeof planEntry>["plan"]>;

function readSession() {
  try {
    return window.sessionStorage.getItem(ENTRY_SESSION_KEY);
  } catch {
    // Storage blocked (private mode, policy): never interrupt.
    return "blocked";
  }
}

function writeSession(value: string) {
  try {
    window.sessionStorage.setItem(ENTRY_SESSION_KEY, value);
  } catch {
    /* ignore */
  }
}

const BACKDROP: Record<string, string> = {
  brand: "from-brand-strong via-navy to-canvas",
  vip: "from-vip-2 via-vip-1 to-canvas",
  warning: "from-warning/25 via-navy to-canvas",
  danger: "from-danger/30 via-navy to-canvas",
  success: "from-success/25 via-navy to-canvas",
  info: "from-brand-strong via-navy to-canvas",
};

const VISUAL_KIND: Partial<Record<EntryItem["visual"], ProductKind>> = {
  iptv: "iptv",
  vip: "vip",
  device: "device",
  player: "player",
  offer: "offer",
};

/**
 * Full-screen entry experiences, mounted once in the site layout:
 *  - Guest / expired / not-yet-subscribed visitors get the acquisition
 *    promotion (admin "Entry screen — guests" items, packages, devices).
 *  - Active members get the Member Spotlight (service status, renewal,
 *    unpaid order, onboarding, member items, upgrade, device, news).
 * It runs on the first meaningful page of a new browser session (never on
 * checkout / sign-in pages), at most once per session: the sessionStorage
 * guard survives navigation and remounts. Rotation avoids repeating the
 * last shown items across sessions (localStorage). No eligible item → no
 * overlay.
 */
export function EntryExperience() {
  const pathname = usePathname();
  const [plan, setPlan] = useState<Plan | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || isQuietPath(pathname) || readSession()) {
      return;
    }

    started.current = true;
    writeSession("pending");

    let cancelled = false;

    fetch("/api/site/entry", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? (response.json() as Promise<EntryPayload>) : { mode: "none" as const }))
      .catch(() => ({ mode: "none" as const }))
      .then((payload) => {
        if (cancelled) {
          return;
        }

        let history = sanitizeHistory(null);

        try {
          history = sanitizeHistory(JSON.parse(window.localStorage.getItem(ENTRY_HISTORY_KEY) ?? "null"));
        } catch {
          /* ignore */
        }

        const result = planEntry(payload, history);

        try {
          window.localStorage.setItem(ENTRY_HISTORY_KEY, JSON.stringify(result.history));
        } catch {
          /* ignore */
        }

        writeSession(result.plan ? `shown:${result.plan.primary.key}` : "none");

        // Don't pop over a page the visitor has meanwhile moved to checkout / sign-in.
        if (result.plan && !isQuietPath(window.location.pathname)) {
          setPlan(result.plan);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const close = useCallback(() => setPlan(null), []);

  if (!plan) {
    return null;
  }

  return <EntryOverlay plan={plan} onClose={close} />;
}

function EntryOverlay({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { t, language } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The overlay only mounts in the browser (after the entry fetch), so the
  // media query can be read once on first render.
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const item = plan.primary;
  const member = plan.mode === "member";

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      // Keep focus inside the dialog.
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const StatusIcon =
    item.visual === "status" ? AlertTriangle : item.visual === "renewal" ? CalendarClock : item.visual === "order" ? CreditCard : item.visual === "player" ? MonitorPlay : Megaphone;
  const productKind = VISUAL_KIND[item.visual];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-title"
      data-testid={member ? "member-spotlight" : "entry-promotion"}
      data-item={item.key}
      className="fixed inset-0 z-[70] overflow-y-auto bg-canvas animate-fade-in"
      lang={language}
    >
      {/* Backdrop composition */}
      <div aria-hidden className={cn("pointer-events-none fixed inset-0 bg-gradient-to-br", BACKDROP[item.tone] ?? BACKDROP.brand)} />
      <div aria-hidden className="pointer-events-none fixed -end-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(55_129_252/0.35),transparent)]" />
      <div aria-hidden className="pointer-events-none fixed -bottom-48 -start-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(203_233_253/0.14),transparent)]" />

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t("إغلاق", "Close")}
        data-testid="entry-close"
        className="glass-soft fixed end-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/15 sm:end-6 sm:top-6"
      >
        <X size={22} aria-hidden />
      </button>

      <div className="relative mx-auto grid min-h-full w-full max-w-6xl content-center gap-8 px-5 pb-10 pt-20 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-16">
        {/* Visual */}
        <div className="relative flex min-h-[32vh] items-center justify-center lg:order-2 lg:min-h-[70vh]">
          <div aria-hidden className="absolute h-[80%] max-h-[30rem] w-[80%] max-w-[30rem] rounded-full border border-glow/15" />
          <div aria-hidden className="absolute h-[58%] max-h-[22rem] w-[58%] max-w-[22rem] rounded-full border border-glow/10" />
          <div className="relative animate-fade-up [animation-delay:120ms]">
            {item.videoUrl && !reduced ? (
              <video
                src={item.videoUrl}
                poster={item.imageUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                aria-hidden
                className="max-h-[42vh] w-full max-w-xl rounded-[1.8rem] border border-white/15 object-cover shadow-float lg:max-h-[60vh]"
              />
            ) : item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="max-h-[42vh] w-auto max-w-full rounded-[1.8rem] object-contain shadow-float lg:max-h-[60vh]" />
            ) : productKind ? (
              <ProductEmblem kind={productKind} floating className="w-44 sm:w-56 lg:w-72" />
            ) : (
              <div className="flex aspect-square w-40 items-center justify-center rounded-[30%] border border-white/20 bg-white/10 text-white sm:w-52 lg:w-64">
                <StatusIcon className="h-[38%] w-[38%]" strokeWidth={1.6} aria-hidden />
              </div>
            )}
          </div>
        </div>

        {/* Copy */}
        <div className="relative flex flex-col justify-center gap-5 lg:order-1">
          <p className="w-fit rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-navy animate-fade-up">
            {member ? t("لك من شاشتنا", "For you from Shashtna") : t("عرض شاشتنا", "Shashtna")} · {item.eyebrow}
          </p>
          <h2 id="entry-title" className="text-balance text-display font-bold text-white animate-fade-up [animation-delay:80ms]">
            {item.title}
          </h2>
          {item.body ? (
            <p className="max-w-xl text-lead text-glow/90 animate-fade-up [animation-delay:140ms]">{item.body}</p>
          ) : null}
          {item.facts.length ? (
            <ul className="grid max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-4">
              {item.facts.slice(0, 4).map((fact, factIndex) => (
                <li
                  key={fact}
                  className="glass-soft flex min-h-14 items-center justify-center rounded-2xl px-3 py-2 text-center text-xs font-bold leading-5 text-white animate-fade-up"
                  style={{ animationDelay: `${200 + factIndex * 70}ms` } as CSSProperties}
                >
                  <span className="line-clamp-2">{fact}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-5 pt-1 animate-fade-up [animation-delay:320ms]">
            {item.price ? (
              <div>
                <p className="nums text-4xl font-bold tracking-tight text-white" dir="auto">
                  {item.price}
                </p>
                {item.priceNote ? <p className="nums mt-1 text-sm text-glow/80">{item.priceNote}</p> : null}
              </div>
            ) : null}
            {item.cta ? (
              item.cta.external ? (
                <a
                  href={item.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  data-testid="entry-cta"
                  className="group inline-flex h-14 items-center gap-3 whitespace-nowrap rounded-2xl bg-white pe-2 ps-6 text-base font-bold text-navy shadow-glow transition hover:bg-glow"
                >
                  {item.cta.label}
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
                    <ArrowLeft size={18} className="ltr:rotate-180" />
                  </span>
                </a>
              ) : (
                <Link
                  href={item.cta.href}
                  onClick={onClose}
                  data-testid="entry-cta"
                  className="group inline-flex h-14 items-center gap-3 whitespace-nowrap rounded-2xl bg-white pe-2 ps-6 text-base font-bold text-navy shadow-glow transition hover:bg-glow"
                >
                  {item.cta.label}
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
                    <ArrowLeft size={18} className="ltr:rotate-180" />
                  </span>
                </Link>
              )
            ) : null}
            <button type="button" onClick={onClose} className="h-14 px-2 text-sm font-semibold text-glow/80 transition hover:text-white">
              {member ? t("متابعة للموقع", "Continue") : t("تصفّح الموقع", "Browse the site")}
            </button>
          </div>

          {member && plan.secondary.length ? (
            <div className="mt-2 border-t border-white/10 pt-5 animate-fade-up [animation-delay:420ms]">
              <p className="text-xs font-bold text-glow/80">{t("كذلك لك", "Also for you")}</p>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {plan.secondary.map((other) => (
                  <li key={other.key}>
                    {other.cta ? (
                      <Link
                        href={other.cta.href}
                        onClick={onClose}
                        className="glass-soft flex h-full flex-col gap-1 rounded-2xl p-4 transition hover:bg-white/10"
                      >
                        <span className="text-[11px] font-bold text-glow/80">{other.eyebrow}</span>
                        <span className="line-clamp-2 text-sm font-bold leading-6 text-white">{other.title}</span>
                      </Link>
                    ) : (
                      <div className="glass-soft flex h-full flex-col gap-1 rounded-2xl p-4">
                        <span className="text-[11px] font-bold text-glow/80">{other.eyebrow}</span>
                        <span className="line-clamp-2 text-sm font-bold leading-6 text-white">{other.title}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
