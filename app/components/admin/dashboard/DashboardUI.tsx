import Link from "next/link";
import { ArrowLeft, CircleSlash } from "lucide-react";
import type { ReactNode } from "react";

import { GlassTile, TileLabel } from "@/app/components/admin/finance/FinanceUI";
import { cn } from "@/app/ui/cn";

/**
 * Console Home building blocks — thin wrappers over the existing Finance
 * glass primitives so the dashboard shares one visual system.
 */

export function SectionCard({
  title,
  icon,
  action,
  children,
  className,
  testId,
  id,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  testId?: string;
  id?: string;
}) {
  return (
    <GlassTile className={cn("flex flex-col", className)} testId={testId}>
      <div id={id} className="flex items-center justify-between gap-3 scroll-mt-24">
        <TileLabel icon={icon}>{title}</TileLabel>
        {action ? (
          <Link href={action.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand-ink hover:text-ink">
            {action.label}
            <ArrowLeft size={13} className="ltr:rotate-180" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </GlassTile>
  );
}

/** A query that failed: say so instead of showing zeros. */
export function SectionError({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-danger/40 px-3 py-3 text-sm text-danger" role="status" data-testid="dashboard-section-error">
      <CircleSlash size={15} aria-hidden />
      {label}
    </p>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-white/[0.03] px-3 py-4 text-center text-sm text-ink-3">{children}</p>;
}

export function KpiTile({
  label,
  value,
  hint,
  chip,
  href,
  hero,
  testId,
  className,
}: {
  className?: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  chip?: ReactNode;
  href: string;
  hero?: boolean;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        "group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-[1.6rem] border p-5 transition",
        className,
        hero
          ? "bg-finance-hero border-white/12 text-white"
          : "border-white/8 bg-[linear-gradient(180deg,rgb(203_233_253/0.07),rgb(203_233_253/0.015)_45%),rgb(6_21_61/0.72)] shadow-card backdrop-blur-xl [border-top-color:rgb(203_233_253/0.18)] hover:border-brand/40",
      )}
    >
      <p className={cn("text-xs font-bold uppercase tracking-[0.12em]", hero ? "text-white/75" : "text-ink-3")}>{label}</p>
      <div className="mt-3">
        <div className={cn("nums text-[1.9rem] font-extrabold leading-none", hero ? "text-white" : "text-ink")}>{value}</div>
        {chip || hint ? (
          <div className={cn("mt-2.5 flex flex-wrap items-center gap-2 text-xs", hero ? "text-white/75" : "text-ink-3")}>
            {chip}
            {hint ? <span>{hint}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
