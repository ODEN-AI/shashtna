import { AppWindow, Download, MonitorPlay } from "lucide-react";

import type { Lang } from "@/src/lib/i18n";
import type { CatalogApp } from "@/src/server/catalog";

import { Badge } from "./Badge";
import { LinkButton } from "./Button";
import { cn } from "./cn";

export function AppCard({ app, lang, compact }: { app: CatalogApp; lang: Lang; compact?: boolean }) {
  const isAr = lang === "ar";

  return (
    <article id={`app-${app.slug}`} className={cn("surface flex h-full flex-col rounded-card p-5 sm:p-6", app.isPlayer && "ring-1 ring-glow/40")}>
      <div className="flex items-start gap-4">
        {app.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.imageUrl}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-2xl border border-line object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-3 text-brand-ink">
            {app.isPlayer ? <MonitorPlay size={24} aria-hidden /> : <AppWindow size={24} aria-hidden />}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">{app.name}</h3>
            {app.isPlayer ? <Badge tone="glow">{isAr ? "الرسمي" : "Official"}</Badge> : null}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-3">
            <span>{app.platform}</span>
            {app.version ? (
              <span className="nums" dir="ltr">
                v{app.version}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-ink-2">{app.description}</p>

      {!compact && app.instructions.length ? (
        <details className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-1 open:pb-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {isAr ? "خطوات الإعداد" : "Setup steps"}
            <span aria-hidden className="text-ink-3">+</span>
          </summary>
          <ol className="mt-1 list-decimal space-y-2 ps-5 text-sm leading-7 text-ink-2 marker:text-ink-3">
            {app.instructions.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      ) : null}

      {!compact && app.notes ? <p className="mt-3 text-xs leading-6 text-ink-3">{app.notes}</p> : null}

      <div className="mt-auto pt-5">
        {app.downloadUrl ? (
          <LinkButton href={app.downloadUrl} external={/^https?:/.test(app.downloadUrl)} variant={app.isPlayer ? "primary" : "secondary"} className="w-full">
            <Download size={16} aria-hidden />
            {isAr ? "تحميل" : "Download"}
          </LinkButton>
        ) : (
          <p className="text-center text-xs text-ink-3">{isAr ? "رابط التحميل غير متوفر حاليًا" : "Download link not available yet"}</p>
        )}
      </div>
    </article>
  );
}
