import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { AppCard } from "@/app/ui/AppCard";
import { LinkButton } from "@/app/ui/Button";
import { Container, Eyebrow } from "@/app/ui/Page";
import { EmptyState, ErrorState } from "@/app/ui/States";
import { getActiveApps, platformsOf, type CatalogApp } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "التطبيقات",
  description: "تحميل Shashtna Player والتطبيقات المدعومة لكل منصة، مع خطوات الإعداد.",
  alternates: { canonical: "/apps" },
};

export default async function AppsPage() {
  const { t, lang } = await getI18n();

  let apps: CatalogApp[] | null = null;

  try {
    apps = await getActiveApps();
  } catch (error) {
    console.error("APPS_PAGE_ERROR:", error);
  }

  return (
    <>
      <section className="bg-cinema border-b border-line">
        <Container className="py-14 sm:py-20">
          <Eyebrow>{t("شاهد على", "Watch on")}</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
            {t("التطبيقات", "Apps")}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-8 text-ink-2">
            {t(
              "حمّل Shashtna Player أو التطبيق المناسب لجهازك، واتبع خطوات الإعداد. بيانات الدخول موجودة بحسابك بعد التفعيل.",
              "Download Shashtna Player or the right app for your device and follow the setup steps. Your login details are in your account after activation.",
            )}
          </p>
        </Container>
      </section>

      <Container className="py-14">
        {apps === null ? (
          <ErrorState
            title={t("تعذر تحميل التطبيقات", "Apps couldn't be loaded")}
            description={t("حدّث الصفحة بعد شوية.", "Refresh the page shortly.")}
            action={<LinkButton href="/apps" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
          />
        ) : apps.length === 0 ? (
          <EmptyState
            title={t("ماكو تطبيقات منشورة حاليًا", "No apps are published right now")}
            description={t("تواصل ويانا ونساعدك تختار التطبيق المناسب.", "Contact us and we'll help you pick the right app.")}
            action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
          />
        ) : (
          <div className="space-y-14">
            {platformsOf(apps).map(({ platform, apps: items }) => (
              <section key={platform} id={encodeURIComponent(platform)} className="scroll-mt-24">
                <h2 className="text-xl font-bold text-ink">{platform}</h2>
                <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((app) => (
                    <AppCard key={app.id} app={app} lang={lang} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="surface mt-16 flex flex-col items-start gap-4 rounded-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <LifeBuoy size={22} className="mt-0.5 shrink-0 text-glow" aria-hidden />
            <div>
              <h2 className="font-bold text-ink">{t("التطبيق ما يشتغل؟", "App not working?")}</h2>
              <p className="mt-1 text-sm text-ink-2">
                {t("شوف خطوات حل المشاكل الشائعة للتثبيت والتشغيل.", "See steps for common install and playback issues.")}
              </p>
            </div>
          </div>
          <LinkButton href="/help/troubleshooting" variant="secondary">
            {t("حل المشاكل", "Troubleshooting")}
          </LinkButton>
        </div>
      </Container>
    </>
  );
}
