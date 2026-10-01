import Link from "next/link";
import { ArrowLeft, Check, Cpu, Gem, Megaphone, MonitorPlay, Tag, Tv } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/app/ui/cn";

/**
 * Product presentation primitives — the web version of Shashtna Mobile's
 * product language: a large, dominant visual first; then name, a short value
 * line, 2–4 fact tiles, benefits, price and one clear action. Used by the
 * package and device cards, the animated showcase and the entry promotion,
 * and ready for the future /plans/[slug] and /devices/[id] pages.
 *
 * Nothing here invents content: every fact, price and image is passed in
 * from real catalogue / admin data, and missing pieces are simply omitted.
 */

export type ProductKind = "iptv" | "vip" | "device" | "player" | "offer";

const STAGE: Record<ProductKind, string> = {
  iptv: "from-brand-strong via-brand-mid to-brand",
  vip: "from-vip-1 via-vip-2 to-vip-3",
  device: "from-navy via-vip-1 to-vip-2",
  player: "from-navy via-brand-strong to-sky",
  offer: "from-brand-strong via-navy to-canvas",
};

const GLYPH: Record<ProductKind, typeof Tv> = {
  iptv: Tv,
  vip: Gem,
  device: Cpu,
  player: MonitorPlay,
  offer: Tag,
};

export function productKind(serviceType: string | null | undefined): ProductKind {
  return String(serviceType ?? "").toUpperCase() === "VIP" ? "vip" : "iptv";
}

/** The brand emblem shown when a product has no admin image (never a stock photo). */
export function ProductEmblem({ kind, className, floating }: { kind: ProductKind; className?: string; floating?: boolean }) {
  const Glyph = kind === "offer" ? Megaphone : GLYPH[kind];

  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-[30%] border border-white/25 bg-gradient-to-br shadow-[0_12px_36px_rgb(25_81_252/0.45)]",
        STAGE[kind],
        floating && "animate-float",
        className ?? "w-28",
      )}
    >
      <span className="absolute inset-0 rounded-[30%] bg-[radial-gradient(55%_55%_at_28%_18%,rgb(203_233_253/0.45),transparent)]" />
      <span className="absolute inset-[13%] rounded-full border border-glow/35" />
      <Glyph className="relative h-[40%] w-[40%] text-white" strokeWidth={1.8} />
    </div>
  );
}

/**
 * The dominant visual band. With an image it fills the stage (cover, or
 * contain for devices/posters) over the product gradient; without one it
 * shows the floating emblem. Children render over the lower edge (badges,
 * name) on a scrim.
 */
export function ProductStage({
  kind,
  imageUrl,
  alt,
  fit = "cover",
  className,
  top,
  children,
}: {
  kind: ProductKind;
  imageUrl?: string | null;
  alt?: string;
  fit?: "cover" | "contain";
  className?: string;
  top?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden bg-gradient-to-br", STAGE[kind], className ?? "aspect-[16/10]")}>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_80%_0%,rgb(203_233_253/0.28),transparent_65%)]" />
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt ?? ""}
            loading="lazy"
            decoding="async"
            className={cn("absolute inset-0 h-full w-full", fit === "contain" ? "object-contain p-6" : "object-cover")}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-canvas/5 via-transparent to-canvas/80" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center pb-6">
          <ProductEmblem kind={kind} className="w-[30%] max-w-32 min-w-20" />
        </div>
      )}
      {top ? <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">{top}</div> : null}
      {children ? <div className="absolute inset-x-0 bottom-0 p-5">{children}</div> : null}
    </div>
  );
}

/** 2–4 short facts as tiles (duration, a spec, a benefit…). */
export function FactTiles({ facts, className, tone = "surface" }: { facts: string[]; className?: string; tone?: "surface" | "glass" }) {
  const shown = facts.filter(Boolean).slice(0, 4);

  if (!shown.length) {
    return null;
  }

  return (
    <ul className={cn("grid gap-2", shown.length === 1 ? "grid-cols-1" : shown.length === 3 ? "grid-cols-3" : "grid-cols-2", className)}>
      {shown.map((fact) => (
        <li
          key={fact}
          className={cn(
            "flex min-h-12 items-center justify-center rounded-xl px-2.5 py-2 text-center text-xs font-semibold leading-5",
            tone === "glass" ? "glass-soft text-white" : "border border-line bg-surface-2 text-ink",
          )}
        >
          <span className="line-clamp-2">{fact}</span>
        </li>
      ))}
    </ul>
  );
}

/** Benefits as a compact checklist. */
export function FeatureList({ features, max = 3, className }: { features: string[]; max?: number; className?: string }) {
  const shown = features.filter(Boolean).slice(0, max);

  if (!shown.length) {
    return null;
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {shown.map((feature) => (
        <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-ink-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky/20 text-glow">
            <Check size={12} strokeWidth={3} aria-hidden />
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

/** Small pill chips (compatibility, categories). */
export function FeatureChips({ items, className }: { items: string[]; className?: string }) {
  if (!items.length) {
    return null;
  }

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => (
        <li key={item} className="rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Price with its currency and an optional note (per-month equivalent, device add-on…). */
export function PriceBlock({
  amount,
  currency,
  note,
  size = "md",
  className,
}: {
  amount: number | null;
  currency: string;
  note?: string | null;
  size?: "md" | "lg";
  className?: string;
}) {
  if (amount === null) {
    return null;
  }

  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-baseline gap-1.5">
        <span className={cn("nums font-bold tracking-tight text-ink", size === "lg" ? "text-4xl" : "text-[26px]")} dir="ltr">
          {new Intl.NumberFormat("en-US").format(amount)}
        </span>
        <span className="text-xs font-semibold text-ink-3">{currency}</span>
      </p>
      {note ? <p className="nums mt-0.5 text-xs text-ink-3">{note}</p> : null}
    </div>
  );
}

/** The product's single primary action, with the mobile "go" arrow. */
export function ProductCta({
  href,
  label,
  emphasis = "primary",
  className,
  external,
}: {
  href: string;
  label: string;
  emphasis?: "primary" | "secondary" | "light";
  className?: string;
  external?: boolean;
}) {
  const classes = cn(
    "group/cta inline-flex h-12 items-center justify-between gap-3 rounded-2xl ps-5 pe-1.5 text-sm font-bold transition active:scale-[0.98]",
    emphasis === "primary" && "bg-gradient-to-l from-brand to-brand-mid text-white shadow-brand hover:brightness-110",
    emphasis === "secondary" && "border border-line-strong bg-surface-2 text-ink hover:border-brand/60",
    emphasis === "light" && "bg-white text-navy shadow-glow hover:bg-glow",
    className,
  );
  const content = (
    <>
      <span className="truncate">{label}</span>
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover/cta:-translate-x-0.5 ltr:group-hover/cta:translate-x-0.5",
          emphasis === "light" ? "bg-navy text-white" : "bg-white/15",
        )}
      >
        <ArrowLeft size={17} className="ltr:rotate-180" />
      </span>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {content}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

/** A translucent information layer over a product visual (no blur). */
export function GlassInfo({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass-soft rounded-2xl p-4", className)}>{children}</div>;
}
