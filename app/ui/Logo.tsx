import Link from "next/link";

import { cn } from "./cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-b from-[#3a78ff] to-[#1639a3] shadow-brand ring-1 ring-white/10",
        className,
      )}
    >
      <span className="text-[17px] font-bold leading-none text-white">ش</span>
      <span className="absolute inset-x-2 bottom-[5px] h-px rounded-full bg-glow/80" />
    </span>
  );
}

export function Logo({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Shashtna — شاشتنا">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold text-ink">شاشتنا</span>
        {subtitle ? (
          <span className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-ink-3">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
