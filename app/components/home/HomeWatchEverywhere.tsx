import Link from "next/link";
import { ArrowLeft, Crown, MonitorPlay, Smartphone, Tv } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { Container, SectionHeading } from "@/app/ui/Page";
import { translator, type Lang } from "@/src/lib/i18n";
import type { CatalogApp } from "@/src/server/catalog";

/**
 * The ecosystem: Shashtna Player at the centre, the TV and phone platforms
 * it runs on, the other platforms that have a published app (Admin → Apps),
 * and VIP devices. Links go to the existing Watch On pages.
 */
export function HomeWatchEverywhere({
  lang,
  platforms,
  hasVip,
}: {
  lang: Lang;
  platforms: { platform: string; apps: CatalogApp[] }[];
  hasVip: boolean;
}) {
  const t = translator(lang);
  const isAr = lang === "ar";
  const count = (n: number) => (isAr ? `${n} ${n === 1 ? "تطبيق" : "تطبيقات"}` : `${n} app${n === 1 ? "" : "s"}`);

  return (
    <section className="relative overflow-hidden border-y border-line bg-surface/40 py-16 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(25_81_252/0.16),transparent)]" />
      <Container className="relative">
        <SectionHeading
          eyebrow={t("شاهد على كل مكان", "Watch everywhere")}
          title={t("اشتراك واحد، على شاشاتك كلها", "One subscription, on all your screens")}
          description={t(
            "Shashtna Player على التلفزيون والموبايل، وتطبيقات مدعومة للمنصات الثانية، وأجهزة VIP جاهزة.",
            "Shashtna Player on your TV and phone, supported apps for other platforms, and ready-made VIP devices.",
          )}
          action={
            <LinkButton href="/watch" variant="ghost">
              {t("الأجهزة المدعومة", "Supported devices")}
              <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
            </LinkButton>
          }
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* The hub */}
          <Link
            href="/watch/player"
            className="surface-raised edge-light group flex flex-col justify-between overflow-hidden rounded-panel p-6 transition hover:border-brand/50 sm:p-8"
          >
            <div className="relative">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-brand">
                <MonitorPlay size={22} aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-bold text-ink">Shashtna Player</h3>
              <p className="mt-2 max-w-sm text-sm leading-7 text-ink-2">
                {t("نفس الاشتراك ونفس الحساب على كل أجهزتك.", "The same plan and the same account on all your devices.")}
              </p>
            </div>
            <ul className="relative mt-6 flex flex-wrap gap-2">
              {[
                { label: "Android TV", icon: <Tv size={14} aria-hidden /> },
                { label: "Google TV", icon: <Tv size={14} aria-hidden /> },
                { label: "Android", icon: <Smartphone size={14} aria-hidden /> },
              ].map((item) => (
                <li key={item.label} className="glass-soft inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink">
                  <span className="text-glow">{item.icon}</span>
                  <span dir="ltr">{item.label}</span>
                </li>
              ))}
            </ul>
          </Link>

          {/* The rest of the ecosystem */}
          <ul className="grid grid-cols-2 gap-4">
            {platforms.slice(0, hasVip ? 3 : 4).map(({ platform, apps }) => (
              <li key={platform}>
                <Link
                  href={`/watch#${encodeURIComponent(platform)}`}
                  className="surface group flex h-full flex-col rounded-card p-5 transition hover:-translate-y-0.5 hover:border-brand/50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-3 text-brand-ink transition group-hover:text-glow">
                    {/tv|تلفز/i.test(platform) ? <Tv size={18} aria-hidden /> : <Smartphone size={18} aria-hidden />}
                  </span>
                  <span className="mt-4 text-[15px] font-bold text-ink">{platform}</span>
                  <span className="mt-1 text-xs text-ink-3">{count(apps.length)}</span>
                </Link>
              </li>
            ))}
            {hasVip ? (
              <li>
                <Link
                  href="/devices"
                  className="surface group flex h-full flex-col rounded-card p-5 transition hover:-translate-y-0.5 hover:border-brand/50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-3 text-glow">
                    <Crown size={18} aria-hidden />
                  </span>
                  <span className="mt-4 text-[15px] font-bold text-ink">{t("أجهزة VIP", "VIP devices")}</span>
                  <span className="mt-1 text-xs text-ink-3">{t("جاهزة لباقات VIP", "Ready for VIP plans")}</span>
                </Link>
              </li>
            ) : null}
            {!platforms.length && !hasVip ? (
              <li className="col-span-2">
                <Link href="/apps" className="surface flex h-full items-center justify-between rounded-card p-5 text-sm font-semibold text-ink-2 hover:text-ink">
                  {t("التطبيقات وروابط التحميل", "Apps and download links")}
                  <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </Container>
    </section>
  );
}
