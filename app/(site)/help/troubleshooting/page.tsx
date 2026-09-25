import type { Metadata } from "next";
import { MessageSquarePlus } from "lucide-react";

import { HelpHero } from "@/app/components/site/HelpHero";
import { LinkButton } from "@/app/ui/Button";
import { Container } from "@/app/ui/Page";
import { TROUBLESHOOTING } from "@/src/content/help";
import { getSessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حل المشاكل",
  description: "خطوات لحل مشاكل التشغيل وتسجيل الدخول وتثبيت التطبيق وأجهزة VIP.",
  alternates: { canonical: "/help/troubleshooting" },
};

export default async function TroubleshootingPage() {
  const [{ t, lang }, user] = await Promise.all([getI18n(), getSessionUser().catch(() => null)]);

  return (
    <>
      <HelpHero
        eyebrow={t("مركز المساعدة", "Help centre")}
        title={t("حل المشاكل", "Troubleshooting")}
        description={t("اختار المشكلة واتبع الخطوات. إذا ما انحلت، افتح تذكرة دعم.", "Pick the issue and follow the steps. If it isn't solved, open a support ticket.")}
      />
      <Container className="grid gap-10 py-14 lg:grid-cols-[240px_1fr]">
        <nav aria-label={t("المشاكل", "Issues")} className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible scrollbar-none">
            {TROUBLESHOOTING.map((guide) => (
              <li key={guide.id} className="shrink-0">
                <a href={`#${guide.id}`} className="block rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink-2 hover:text-ink">
                  {guide.title[lang]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-6">
          {TROUBLESHOOTING.map((guide) => (
            <article key={guide.id} id={guide.id} className="surface scroll-mt-24 rounded-panel p-6 sm:p-8">
              <h2 className="text-xl font-bold text-ink">{guide.title[lang]}</h2>
              <p className="mt-2 text-sm text-ink-3">{guide.symptoms[lang]}</p>
              <ol className="mt-5 space-y-3">
                {guide.steps.map((step, index) => (
                  <li key={step.en} className="flex items-start gap-3">
                    <span className="nums flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-xs font-bold text-ink">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-sm leading-7 text-ink-2">{step[lang]}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-6 border-t border-line pt-5">
                <LinkButton
                  href={user ? `/support/new?category=${guide.category}&topic=${guide.id}` : `/login?redirect=${encodeURIComponent(`/support/new?category=${guide.category}&topic=${guide.id}`)}`}
                  variant="secondary"
                  size="sm"
                >
                  <MessageSquarePlus size={15} aria-hidden />
                  {t("ما انحلت؟ افتح تذكرة", "Not solved? Open a ticket")}
                </LinkButton>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
