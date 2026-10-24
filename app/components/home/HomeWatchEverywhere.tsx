import Link from "next/link";
import { ArrowLeft, Check, Crown, Smartphone, Tv } from "lucide-react";

import { buttonClass } from "@/app/ui/Button";
import { LogoMark } from "@/app/ui/Logo";
import { Container } from "@/app/ui/Page";
import { translator, type Lang } from "@/src/lib/i18n";
import type { CatalogApp } from "@/src/server/catalog";

/**
 * Where to watch, in one section: Shashtna Player (what it is, what it gives
 * you, and the download link), then the other platforms that have a
 * published app (Admin → Apps) and the VIP devices. There is no picture of
 * the app in the project, so the Player is shown by the brand mark and its
 * real facts instead of a drawn screen. Links go to the existing Watch On pages.
 */
export function HomeWatchEverywhere({
  lang,
  platforms,
  hasVip,
  hasPlayerApp,
}: {
  lang: Lang;
  platforms: { platform: string; apps: CatalogApp[] }[];
  hasVip: boolean;
  hasPlayerApp: boolean;
}) {
  const t = translator(lang);
  const isAr = lang === "ar";
  const count = (n: number) => (isAr ? (n === 1 ? "تطبيق واحد" : n === 2 ? "تطبيقان" : `${n} تطبيقات`) : `${n} app${n === 1 ? "" : "s"}`);

  return (
    <section className="py-14 sm:py-20" aria-labelledby="home-watch-heading">
      <Container>
        <h2 id="home-watch-heading" className="text-balance text-h2 font-bold text-ink">
          {t("شاهد على أجهزتك", "Watch on your devices")}
        </h2>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-8 text-ink-2">
          {t(
            "نفس الاشتراك ونفس الحساب على التلفزيون والموبايل، عن طريق Shashtna Player أو التطبيقات المدعومة.",
            "The same plan and the same account on your TV and phone, with Shashtna Player or a supported app.",
          )}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          {/* Shashtna Player: brand mark and real facts, no drawn screen */}
          <div className="rounded-panel border border-line bg-surface p-5 sm:p-7" data-testid="home-player">
            <div className="flex items-center gap-4">
              <LogoMark className="h-14 w-14" />
              <div>
                <h3 className="text-xl font-bold text-ink">Shashtna Player</h3>
                <p className="mt-0.5 text-sm text-ink-3" dir="ltr">
                  Android TV · Google TV · Android
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm leading-6 text-ink-2">
              {[
                t("بيانات اشتراكك موجودة بحسابك وجاهزة للنسخ", "Your subscription details are in your account, ready to copy"),
                t("روابط تحميل وخطوات إعداد واضحة", "Clear download links and setup steps"),
                t("دعم فني مرتبط باشتراكك عند الحاجة", "Support linked to your subscription when you need it"),
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check size={16} className="mt-1 shrink-0 text-brand-ink" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/watch/player" className={buttonClass("primary", "md", "mt-6")}>
              {hasPlayerApp ? t("تحميل Shashtna Player", "Get Shashtna Player") : t("عن Shashtna Player", "About Shashtna Player")}
              <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
            </Link>
          </div>

          {/* The other platforms with a published app, and the VIP devices */}
          <div className="flex flex-col">
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
              {platforms.slice(0, 4).map(({ platform, apps }) => (
                <li key={platform}>
                  <Link
                    href={`/watch#${encodeURIComponent(platform)}`}
                    className="flex min-h-14 items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="text-brand-ink" aria-hidden>
                      {/tv|تلفز/i.test(platform) ? <Tv size={18} /> : <Smartphone size={18} />}
                    </span>
                    <span className="flex-1 font-bold text-ink" dir="auto">
                      {platform}
                    </span>
                    <span className="text-sm text-ink-3">{count(apps.length)}</span>
                    <ArrowLeft size={15} className="text-ink-3 ltr:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
              {hasVip ? (
                <li>
                  <Link href="/devices" className="flex min-h-14 items-center gap-3 bg-vip-field px-5 py-3 transition-colors hover:bg-vip-soft">
                    <Crown size={18} className="text-vip" aria-hidden />
                    <span className="flex-1 font-bold text-vip">{t("أجهزة VIP", "VIP devices")}</span>
                    <span className="text-sm text-vip-text">{t("جاهزة لباقات VIP", "Ready for VIP plans")}</span>
                    <ArrowLeft size={15} className="text-vip-text ltr:rotate-180" aria-hidden />
                  </Link>
                </li>
              ) : null}
              {!platforms.length && !hasVip ? (
                <li>
                  <Link href="/apps" className="flex min-h-14 items-center justify-between px-5 py-3 text-sm font-semibold text-ink-2 hover:text-ink">
                    {t("التطبيقات وروابط التحميل", "Apps and download links")}
                    <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
                  </Link>
                </li>
              ) : null}
            </ul>
            <Link href="/watch" className="mt-3 inline-flex h-11 items-center gap-2 self-start text-sm font-semibold text-ink-2 transition-colors hover:text-ink">
              {t("كل الأجهزة المدعومة وطريقة الإعداد", "All supported devices and setup")}
              <ArrowLeft size={15} className="ltr:rotate-180" aria-hidden />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
