import type { Metadata } from "next";
import { Check, Clock, Download, LifeBuoy, MonitorPlay } from "lucide-react";

import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Container, Eyebrow, SectionHeading } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { getActiveApps, safeHref } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";
import { getSettings } from "@/src/server/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shashtna Player",
  description: "Shashtna Player — المشغل الرسمي لشاشتنا على أندرويد وأندرويد TV. التحميل وخطوات الإعداد.",
  alternates: { canonical: "/watch/player" },
};

export default async function PlayerPage() {
  const [{ t }, apps, settings] = await Promise.all([
    getI18n(),
    getActiveApps().catch(() => []),
    getSettings(),
  ]);

  const playerApps = apps.filter((app) => app.isPlayer);
  const configuredDownload = safeHref(settings["player.downloadUrl"]);
  const primary = playerApps[0];
  const downloadUrl = configuredDownload ?? primary?.downloadUrl ?? null;
  const steps = primary?.instructions.length
    ? primary.instructions
    : [
        t("حمّل Shashtna Player على جهازك.", "Install Shashtna Player on your device."),
        t("سجّل دخولك بالتطبيق بحسابك أو ببيانات اشتراكك (موجودة بـ«اشتراكاتي»).", "Sign in to the app with your account or your subscription details (found under Subscriptions)."),
        t("ابدأ المشاهدة.", "Start watching."),
      ];

  return (
    <>
      <section className="bg-cinema border-b border-line">
        <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow>Shashtna Player</Eyebrow>
            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
              {t("المشغل الرسمي لشاشتنا", "The official Shashtna player")}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-8 text-ink-2">
              {t(
                "Shashtna Player هو تطبيق شاشتنا لأندرويد وأندرويد TV. سجّل دخولك بحسابك أو ببيانات اشتراكك حسب ما يطلب التطبيق، وشاهد على تلفزيونك أو موبايلك.",
                "Shashtna Player is Shashtna's app for Android and Android TV. Sign in with your account or your subscription details, as the app asks, and watch on your TV or phone.",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {downloadUrl ? (
                <LinkButton href={downloadUrl} external={/^https?:/.test(downloadUrl)} size="lg">
                  <Download size={18} aria-hidden />
                  {t("تحميل Shashtna Player", "Download Shashtna Player")}
                </LinkButton>
              ) : null}
              <LinkButton href="/apps" variant="secondary" size="lg">
                {t("كل التطبيقات", "All apps")}
              </LinkButton>
            </div>
            {!downloadUrl ? (
              <Notice tone="info" className="mt-6 max-w-lg">
                {t(
                  "رابط التحميل غير منشور حاليًا على الموقع. تواصل ويانا ونرسلك الرابط.",
                  "The download link isn't published on the website yet. Contact us and we'll send it to you.",
                )}
              </Notice>
            ) : null}
            {playerApps.length ? (
              <p className="mt-6 text-xs text-ink-3">
                {t("متوفر على: ", "Available on: ")}
                {[...new Set(playerApps.map((app) => app.platform))].join("، ")}
                {primary?.version ? (
                  <>
                    {" · "}
                    <span className="nums" dir="ltr">v{primary.version}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="surface-raised flex aspect-[4/3] items-center justify-center rounded-panel">
            <span className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-b from-[#3a78ff] to-[#1639a3] text-white shadow-brand">
              <MonitorPlay size={44} aria-hidden />
            </span>
          </div>
        </Container>
      </section>

      <Container className="grid gap-12 py-14 lg:grid-cols-2">
        <section>
          <SectionHeading eyebrow={t("الإعداد", "Setup")} title={t("شلون تبدأ", "How to get started")} />
          <ol className="mt-6 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="surface flex items-start gap-4 rounded-card p-5">
                <span className="nums flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-7 text-ink-2">{step}</p>
              </li>
            ))}
          </ol>
          <LinkButton href="/help/troubleshooting" variant="ghost" className="mt-4">
            <LifeBuoy size={16} aria-hidden />
            {t("واجهتك مشكلة؟", "Having trouble?")}
          </LinkButton>
        </section>

        <section>
          <SectionHeading eyebrow={t("الميزات", "Features")} title={t("المتوفر اليوم والقادم", "Available now and coming next")} />
          <div className="mt-6 space-y-4">
            <div className="surface rounded-card p-6">
              <Badge tone="success">{t("متوفر الآن", "Available now")}</Badge>
              <ul className="mt-4 space-y-3 text-sm text-ink-2">
                {[
                  t("تسجيل الدخول بحسابك أو ببيانات اشتراكك", "Sign in with your account or subscription details"),
                  t("المشاهدة على أندرويد وأندرويد TV", "Watch on Android and Android TV"),
                  t("الدعم الفني عبر تذاكر الحساب وقنوات التواصل", "Support via account tickets and our contact channels"),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-1 shrink-0 text-success" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-card border border-dashed border-line-strong p-6">
              <Badge tone="neutral">{t("قريبًا", "Coming soon")}</Badge>
              <ul className="mt-4 space-y-3 text-sm text-ink-3">
                {[
                  t("ربط التطبيق بحسابك برمز QR", "Link the app to your account with a QR code"),
                  t("إدارة أجهزتك من حسابك", "Manage your devices from your account"),
                  t("التجديد مباشرة من داخل التطبيق", "Renew directly from the app"),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Clock size={16} className="mt-1 shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </Container>
    </>
  );
}
