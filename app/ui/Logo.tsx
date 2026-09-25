import Link from "next/link";

import { cn } from "./cn";

/**
 * Official Shashtna brand assets (public/brand). The artwork is used as
 * supplied: `shashtna-logo.webp` is the original file, `shashtna-logo.png` the
 * same image with its transparent margin trimmed, and `shashtna-mark.png` the
 * TV mark taken from it for square spots. The UI loads downscaled copies.
 * The halo only lifts the navy lettering off the dark canvas.
 */
export const LOGO_SRC = "/brand/shashtna-logo-640.webp";
export const MARK_SRC = "/brand/shashtna-mark-256.webp";

const halo =
  "[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.7))_drop-shadow(0_0_10px_rgba(96,165,250,0.28))]";

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
      src={LOGO_SRC}
      alt="شاشتنا — Shashtna"
      width={640}
      height={374}
      decoding="async"
      className={cn("w-auto shrink-0 object-contain", className ?? "h-12 sm:h-[52px]", halo)}
    />
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center" aria-label="شاشتنا — Shashtna">
      <LogoImage className={className} />
    </Link>
  );
}
