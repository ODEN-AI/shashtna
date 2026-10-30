import { AppWindow, Download, Plus } from "lucide-react";

import { translator, type Lang } from "@/src/lib/i18n";
import type { CatalogApp } from "@/src/server/catalog";

import p from "./apps.module.css";

// Shashtna Player's icon when the catalogue has no picture for it.
const MARK = "/brand/shashtna-mark-256.webp";

/**
 * One app on /apps: icon, name, platform and version, description, setup
 * steps (folded), notes and the download link. Shashtna Player, the
 * official app, gets the royal card and a wider span. The account area
 * keeps the shared AppCard.
 */
export function AppTile({ app, lang, platformName }: { app: CatalogApp; lang: Lang; platformName: string }) {
  const t = translator(lang);
  const external = /^https?:/.test(app.downloadUrl);

  return (
    <article id={`app-${app.slug}`} className={`${p.app} ${app.isPlayer ? p.appPlayer : ""} scroll-mt-24`} data-testid="app-card">
      <div className={p.appTop}>
        <span className={p.appIcon}>
          {app.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.imageUrl} alt="" loading="lazy" />
          ) : app.isPlayer ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={MARK} alt="" className={p.mark} />
          ) : (
            <AppWindow size={28} aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <h3 className={p.appName} dir="auto">
            {app.name}
            {app.isPlayer ? <span className={p.official}>{t("الرسمي", "Official")}</span> : null}
          </h3>
          <p className={p.appMeta}>
            <span>{platformName}</span>
            {app.version ? (
              <span className="nums" dir="ltr">
                v{app.version}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {app.description ? (
        <p className={p.appText} dir="auto">
          {app.description}
        </p>
      ) : null}

      {app.instructions.length ? (
        <details className={p.steps}>
          <summary>
            {t("خطوات الإعداد", "Setup steps")}
            <span className={p.plus} aria-hidden>
              <Plus size={16} />
            </span>
          </summary>
          <ol>
            {app.instructions.map((step) => (
              <li key={step} dir="auto">
                {step}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {app.notes ? (
        <p className={p.notes} dir="auto">
          {app.notes}
        </p>
      ) : null}

      <div className={p.appFoot}>
        {app.downloadUrl ? (
          <a
            href={app.downloadUrl}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`${p.btn} ${app.isPlayer ? p.btnWhite : p.btnPrimary}`}
          >
            <Download size={18} aria-hidden />
            {t("تحميل", "Download")}
          </a>
        ) : (
          <p className={p.unavailable}>{t("رابط التحميل غير متوفر حاليًا", "Download link not available yet")}</p>
        )}
      </div>
    </article>
  );
}
