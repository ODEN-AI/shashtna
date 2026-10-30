import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, MonitorPlay } from "lucide-react";

import p from "@/app/components/apps/apps.module.css";
import { AppTile } from "@/app/components/apps/AppTile";
import s from "@/app/components/home/home.module.css";
import { LinkButton } from "@/app/ui/Button";
import { EmptyState, ErrorState } from "@/app/ui/States";
import { getActiveApps, platformsOf, type CatalogApp } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "التطبيقات",
  description: "تحميل Shashtna Player والتطبيقات المدعومة لكل منصة، مع خطوات الإعداد.",
  alternates: { canonical: "/apps" },
};

// Platform names as customers say them (the catalogue stores codes such as ANDROID).
const PLATFORM_NAMES: Record<string, string> = { ANDROID_TV: "Android TV", ANDROID: "Android", IOS: "iOS", WINDOWS: "Windows" };
const platformName = (platform: string) => PLATFORM_NAMES[platform.toUpperCase().replace(/[\s-]+/g, "_")] ?? platform;

/**
 * Apps in the site's navy direction: a head with one link per platform and
 * a TV and phone with Shashtna's logo, then one chapter per platform with its apps
 * (Shashtna Player first and highlighted), and a closing help band. Every
 * app, platform and link comes from the catalogue.
 */
export default async function AppsPage() {
  const { t, lang } = await getI18n();

  let apps: CatalogApp[] | null = null;

  try {
    apps = await getActiveApps();
  } catch (error) {
    console.error("APPS_PAGE_ERROR:", error);
  }

  const groups = apps ? platformsOf(apps) : [];
  const player = apps?.find((app) => app.isPlayer);

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <div className={s.wrap}>
        <section className={p.head} aria-labelledby="apps-title">
          <div>
            <p className={s.kicker}>{t("شاهد على", "Watch on")}</p>
            <h1 id="apps-title" className={p.title}>
              {t("التطبيقات", "Apps")}
            </h1>
            <p className={p.lead}>
              {t(
                "حمّل Shashtna Player أو التطبيق المناسب لجهازك، واتبع خطوات الإعداد. بيانات الدخول موجودة بحسابك بعد التفعيل.",
                "Download Shashtna Player or the right app for your device and follow the setup steps. Your login details are in your account after activation.",
              )}
            </p>
            {groups.length ? (
              <ul className={p.platforms} aria-label={t("المنصات", "Platforms")}>
                {groups.map(({ platform, apps: items }) => (
                  <li key={platform}>
                    <a href={`#${encodeURIComponent(platform)}`} className={p.platform}>
                      <span className={`${p.platformCount} nums`}>{items.length}</span>
                      {platformName(platform)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className={p.screenWrap}>
            <div className={p.screen}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/shashtna-logo-white-256.webp" alt="" />
            </div>
            <div className={p.phone} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/shashtna-mark-256.webp" alt="" />
            </div>
            {player ? (
              <a href={`#app-${player.slug}`} className={p.chipFloat}>
                <span className={p.chipIcon}>
                  <MonitorPlay size={20} aria-hidden />
                </span>
                <span>
                  <small>{t("التطبيق الرسمي", "The official app")}</small>
                  <b dir="auto">{player.name}</b>
                </span>
              </a>
            ) : null}
          </div>
        </section>

        {apps === null ? (
          <div className={s.section}>
            <ErrorState
              title={t("تعذر تحميل التطبيقات", "Apps couldn't be loaded")}
              description={t("حدّث الصفحة بعد شوية.", "Refresh the page shortly.")}
              action={<LinkButton href="/apps" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
            />
          </div>
        ) : apps.length === 0 ? (
          <div className={s.section}>
            <EmptyState
              title={t("ماكو تطبيقات منشورة حاليًا", "No apps are published right now")}
              description={t("تواصل ويانا ونساعدك تختار التطبيق المناسب.", "Contact us and we'll help you pick the right app.")}
              action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
            />
          </div>
        ) : (
          groups.map(({ platform, apps: items }) => (
            <section key={platform} id={encodeURIComponent(platform)} className={`${p.group} scroll-mt-24`} aria-labelledby={`platform-${encodeURIComponent(platform)}`}>
              <div className={p.groupHead}>
                <h2 id={`platform-${encodeURIComponent(platform)}`} className={p.groupTitle}>
                  {platformName(platform)}
                </h2>
                <p className={`${p.groupNote} nums`}>
                  {t(`${items.length} ${items.length === 1 ? "تطبيق" : "تطبيقات"}`, `${items.length} ${items.length === 1 ? "app" : "apps"}`)}
                </p>
              </div>
              <div className={p.grid}>
                {[...items]
                  .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer))
                  .map((app) => (
                    <AppTile key={app.id} app={app} lang={lang} platformName={platformName(platform)} />
                  ))}
              </div>
            </section>
          ))
        )}

        <section className={p.help} aria-labelledby="apps-help">
          <div>
            <h2 id="apps-help">{t("التطبيق ما يشتغل؟", "App not working?")}</h2>
            <p>{t("شوف خطوات حل المشاكل الشائعة للتثبيت والتشغيل.", "See steps for common install and playback issues.")}</p>
          </div>
          <div className={p.helpActions}>
            <Link href="/help/troubleshooting" className={`${p.btn} ${p.btnWhite}`}>
              <LifeBuoy size={18} aria-hidden />
              {t("حل المشاكل", "Troubleshooting")}
            </Link>
            <Link href="/help/contact" className={`${p.btn} ${p.btnGlass}`}>
              {t("تواصل ويانا", "Contact us")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
