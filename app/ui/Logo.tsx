import Link from "next/link";

import { cn } from "./cn";

/**
 * Official Shashtna brand assets (public/brand). The artwork is used as
 * supplied: `shashtna-logo.webp` is the original file, `shashtna-logo.png` the
 * same image with its transparent margin trimmed, and `shashtna-mark.png` the
 * TV mark taken from it for square spots. The UI loads downscaled copies.
 * The halo only lifts the navy lettering off the navy canvas.
 */
export const LOGO_SRC = "/brand/shashtna-logo-640.webp";
/**
 * The official white Shashtna logo — the exact emblem asset used by the
 * redesigned Shashtna Mobile app (assets/brand/logo.png, byte-identical copy
 * in public/brand/shashtna-logo-white.png, with downscaled webp copies).
 */
export const WHITE_LOGO_SRC = "/brand/shashtna-logo-white-256.webp";
export const MARK_SRC = "/brand/shashtna-mark-256.webp";

const halo =
  "[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.85))_drop-shadow(0_0_10px_rgba(203,233,253,0.32))]";

export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MARK_SRC}
      alt=""
      aria-hidden
      width={256}
      height={256}
      decoding="async"
      className={cn("shrink-0 object-contain", className ?? "h-9 w-9", halo)}
    />
  );
}

export function LogoImage({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={WHITE_LOGO_SRC}
      srcSet="/brand/shashtna-logo-white-128.webp 128w, /brand/shashtna-logo-white-256.webp 256w, /brand/shashtna-logo-white.png 512w"
      sizes="64px"
      alt="شاشتنا — Shashtna"
      width={256}
      height={256}
      decoding="async"
      className={cn(
        "aspect-square w-auto shrink-0 rounded-full object-contain shadow-[0_8px_24px_rgb(55_129_252/0.35)]",
        className ?? "h-11",
      )}
    />
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center rounded-full" aria-label="شاشتنا — Shashtna">
      <LogoImage className={className} />
    </Link>
  );
}
