import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Crown, KeyRound, MonitorPlay, QrCode, Smartphone, Tv, UserRound } from "lucide-react";

import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Container, Eyebrow, SectionHeading } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { getActiveApps, getActiveDevices, platformsOf } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "شاهد على",
  description: "الأجهزة والمنصات المدعومة لمشاهدة اشتراك شاشتنا، مع التطبيق المناسب لكل جهاز وخطوات الإعداد.",
  alternates: { canonical: "/watch" },
};

export default async function WatchPage() {
  const { t, isAr } = await getI18n();
  const [apps, devices] = await Promise.all([
    getActiveApps().catch(() => []),
    getActiveDevices().catch(() => []),
  ]);
  const platforms = platformsOf(apps);

  return (
    <>
      <section className="bg-cinema border-b border-line">
        <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow>{t("شاهد على", "Watch on")}</Eyebrow>
            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
              {t("شغّل اشتراكك على جهازك", "Watch your subscription on your device")}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-8 text-ink-2">
              {t(
                "اختار جهازك، حمّل التطبيق المناسب، وأدخل بيانات اشتراكك من حسابك. أو اختار جهاز VIP جاهز.",
                "Pick your device, install the right app and enter your subscription details from your account — or choose a ready-made VIP device.",
              )}
            </p>
          </div>
          <Link
            href="/watch/player"
            className="surface-raised group relative block overflow-hidden rounded-panel p-6 ring-1 ring-glow/30 transition hover:ring-glow/60"
          >
            <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-glow/80 to-transparent" />
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-brand">
              <MonitorPlay size={22} aria-hidden />
            </span>
            <p className="mt-5 text-lg font-bold text-ink">Shashtna Player</p>
            <p className="mt-2 text-sm leading-7 text-ink-2">
              {t("المشغل الرسمي لأندرويد وأندرويد TV.", "The official player for Android and Android TV.")}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-ink">
              {t("التفاصيل والتحميل", "Details and download")}
              <ArrowLeft size={15} className="transition group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        </Container>
      </section>

      <Container className="py-14">
        <SectionHeading
          eyebrow={t("المنصات المدعومة", "Supported platforms")}
          title={t("اختار جهازك", "Choose your device")}
          description={t("كل منصة إلها تطبيق جاهز مع خطوات الإعداد.", "Each platform has a ready app with setup steps.")}
        />
        {platforms.length || devices.length ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platforms.map(({ platform, apps: items }) => (
              <li key={platform} id={encodeURIComponent(platform)} className="scroll-mt-24">
                <div className="surface h-full rounded-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-3 text-brand-ink">
                      {/tv|تلفز/i.test(platform) ? <Tv size={20} aria-hidden /> : <Smartphone size={20} aria-hidden />}
                    </span>
                    <h3 className="text-base font-bold text-ink">{platform}</h3>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-ink-3">{t("التطبيق المقترح", "Recommended app")}</p>
                  <ul className="mt-2 space-y-2">
                    {items.map((app, index) => (
                      <li key={app.id}>
                        <Link
                          href={`/apps#app-${app.slug}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm font-semibold text-ink transition hover:border-brand/50"
                        >
                          <span className="truncate">{app.name}</span>
                          {index === 0 ? <Badge tone={app.isPlayer ? "glow" : "brand"}>{t("مقترح", "Best")}</Badge> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
            {devices.length ? (
              <li>
                <div className="surface h-full rounded-card p-6 ring-1 ring-glow/20">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-3 text-glow">
                      <Crown size={20} aria-hidden />
                    </span>
                    <h3 className="text-base font-bold text-ink">{t("أجهزة VIP", "VIP devices")}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-ink-2">
                    {isAr
                      ? `${devices.length} ${devices.length === 1 ? "جهاز متوفر" : "أجهزة متوفرة"} لباقات VIP.`
                      : `${devices.length} device${devices.length === 1 ? "" : "s"} available for VIP plans.`}
                  </p>
                  <LinkButton href="/devices" variant="secondary" className="mt-4 w-full">
                    {t("شوف الأجهزة", "See devices")}
                  </LinkButton>
                </div>
              </li>
            ) : null}
          </ul>
        ) : (
          <EmptyState
            className="mt-8"
            title={t("قائمة الأجهزة قيد التحديث", "The device list is being updated")}
            action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
          />
        )}

        <section className="mt-20">
          <SectionHeading eyebrow={t("الإعداد", "Setup")} title={t("ثلاث خطوات وتبدأ", "Three steps and you're watching")} />
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: <MonitorPlay size={19} aria-hidden />, title: t("حمّل التطبيق", "Install the app"), body: t("من صفحة التطبيقات، حسب جهازك.", "From the Apps page, for your device.") },
              { icon: <UserRound size={19} aria-hidden />, title: t("افتح حسابك", "Open your account"), body: t("بيانات اشتراكك موجودة بـ«اشتراكاتي» بعد التفعيل.", "Your subscription details are under Subscriptions after activation.") },
              { icon: <KeyRound size={19} aria-hidden />, title: t("سجّل دخولك بالتطبيق", "Sign in to the app"), body: t("بحسابك أو ببيانات اشتراكك حسب التطبيق، وابدأ المشاهدة.", "With your account or subscription details, depending on the app, and start watching.") },
            ].map((step, index) => (
              <li key={step.title} className="surface rounded-card p-6">
                <div className="flex items-center gap-3">
                  <span className="nums flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{index + 1}</span>
                  <span className="text-glow">{step.icon}</span>
                </div>
                <h3 className="mt-4 font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20">
          <div className="rounded-panel border border-dashed border-line-strong p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="neutral">{t("قريبًا", "Coming soon")}</Badge>
              <h2 className="text-lg font-bold text-ink">{t("ربط الأجهزة بحسابك", "Linking devices to your account")}</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-2">
              {t(
                "نشتغل على ربط Shashtna Player بحسابك برمز QR — بدل ما تكتب البيانات يدويًا، وحتى تشوف أجهزتك وتديرها من حسابك. هذه الميزة غير متوفرة بعد.",
                "We're working on linking Shashtna Player to your account with a QR code — instead of typing details by hand — and on seeing and managing your devices from your account. This isn't available yet.",
              )}
            </p>
            <QrCode size={28} className="mt-4 text-ink-3" aria-hidden />
          </div>
        </section>
      </Container>
    </>
  );
}
