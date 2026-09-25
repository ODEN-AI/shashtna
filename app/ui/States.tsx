import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Lock } from "lucide-react";

import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/60 text-center",
        compact ? "px-5 py-8" : "px-6 py-14",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-ink-3">
        {icon ?? <Inbox size={22} aria-hidden />}
      </div>
      <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-card border border-danger/25 bg-danger/5 px-6 py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle size={22} aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-ink-2">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function UnauthorizedState({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <EmptyState
      icon={<Lock size={22} aria-hidden />}
      title={title}
      description={description}
    />
  );
}

export function Notice({
  tone = "info",
  children,
  title,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info/25 bg-info/5 text-info",
    success: "border-success/25 bg-success/5 text-success",
    warning: "border-warning/25 bg-warning/5 text-warning",
    danger: "border-danger/25 bg-danger/5 text-danger",
  };

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-2xl border px-4 py-3 text-sm leading-6", tones[tone], className)}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <div className="text-ink-2">{children}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-10 sm:px-6" aria-busy>
      <SkeletonBlock className="h-8 w-56" />
      <SkeletonBlock className="h-44 w-full rounded-card" />
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonBlock className="h-28 rounded-card" />
        <SkeletonBlock className="h-28 rounded-card" />
        <SkeletonBlock className="h-28 rounded-card" />
      </div>
    </div>
  );
}
