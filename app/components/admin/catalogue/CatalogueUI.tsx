import { Boxes, Cpu, ImageOff, LayoutGrid, Link2, Package } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/app/ui/Badge";
import { cn } from "@/app/ui/cn";
import { LinkTabs } from "@/app/ui/Tabs";
import { safeHref } from "@/src/lib/safe-href";
import type { Translate } from "@/src/lib/i18n";

/** Catalogue building blocks, on top of the console's existing primitives. */

export type CatalogueSection = "overview" | "packages" | "devices" | "compatibility";

export function CatalogueHeader({ active, t, title, description, actions }: { active: CatalogueSection; t: Translate; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  const tabs = [
    { key: "overview", href: "/admin/catalogue", label: <><LayoutGrid size={14} aria-hidden /> {t("نظرة عامة", "Overview")}</> },
    { key: "packages", href: "/admin/catalogue/packages", label: <><Package size={14} aria-hidden /> {t("الباقات", "Packages")}</> },
    { key: "devices", href: "/admin/catalogue/devices", label: <><Cpu size={14} aria-hidden /> {t("الأجهزة", "Devices")}</> },
    { key: "compatibility", href: "/admin/catalogue/compatibility", label: <><Link2 size={14} aria-hidden /> {t("التوافق", "Compatibility")}</> },
  ];

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
            <Boxes size={14} aria-hidden /> {t("الكتالوج", "Catalogue")}
          </p>
          <h1 className="mt-2 text-h2 font-bold text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <LinkTabs label={t("أقسام الكتالوج", "Catalogue sections")} active={active} tabs={tabs} />
    </header>
  );
}

export function ProductThumb({ src, className }: { src: string | null | undefined; className?: string }) {
  const url = safeHref(src);

  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2 text-ink-3", className ?? "h-12 w-12")}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ImageOff size={16} aria-hidden />
      )}
    </span>
  );
}

export function ActiveBadge({ active, t }: { active: boolean; t: Translate }) {
  return (
    <span data-testid="catalogue-status" data-active={active}>
      <Badge tone={active ? "success" : "neutral"} dot>
        {active ? t("فعّال", "Active") : t("موقوف", "Inactive")}
      </Badge>
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return <Badge tone={type === "VIP" ? "glow" : "brand"}>{type}</Badge>;
}

export function CompatChip({ name, active, href, t }: { name: string; active: boolean; href?: string; t: Translate }) {
  const body = (
    <>
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-success" : "bg-ink-3")} aria-hidden />
      {name}
      {active ? null : <span className="text-ink-3">· {t("موقوف", "inactive")}</span>}
    </>
  );
  const className = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2";

  return href ? (
    <a href={href} className={cn(className, "hover:border-brand/50 hover:text-ink")} data-testid="compat-chip">
      {body}
    </a>
  ) : (
    <span className={className} data-testid="compat-chip">
      {body}
    </span>
  );
}
