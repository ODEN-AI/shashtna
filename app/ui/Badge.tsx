import type { ReactNode } from "react";

import { cn } from "./cn";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "glow";

const tones: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface-3 text-ink-2",
  brand: "border-brand/40 bg-brand/15 text-brand-ink",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
  glow: "border-glow/30 bg-glow/10 text-glow",
};

export function Badge({
  tone = "neutral",
  children,
  dot,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
  SUSPENDED: "neutral",
  PENDING: "info",
  NONE: "neutral",
  SUBMITTED: "info",
  AWAITING_PAYMENT: "warning",
  PAID: "brand",
  FULFILLING: "glow",
  COMPLETED: "success",
  CANCELLED: "neutral",
  REJECTED: "danger",
  OPEN: "info",
  IN_PROGRESS: "warning",
  CLOSED: "neutral",
  DEGRADED: "warning",
  OUTAGE: "danger",
  MAINTENANCE: "info",
  OPERATIONAL: "success",
  NEW: "info",
  CONTACTED: "brand",
  WON: "success",
  LOST: "neutral",
  REQUESTED: "warning",
  ISSUED: "brand",
  USED: "success",
  DISMISSED: "neutral",
};

/** A badge whose colour follows the shared status vocabulary. */
export function StatusBadge({ status, label }: { status: string; label: ReactNode }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot>
      {label}
    </Badge>
  );
}
