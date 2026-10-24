import { ArrowLeft } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { Container } from "@/app/ui/Page";
import { translator, type Lang } from "@/src/lib/i18n";

/**
 * The last word on the homepage: one line and one action. The Player and
 * the account each have their own place higher up (and sign-up happens at
 * checkout), so they are not offered again here.
 */
export function HomeFinalCta({ lang }: { lang: Lang }) {
  const t = translator(lang);

  return (
    <section className="py-14 sm:py-20">
      <Container>
        <div
          className="flex flex-col gap-5 rounded-panel border border-line bg-surface-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10"
          data-testid="home-final-cta"
        >
          <div>
            <h2 className="text-balance text-h2 font-bold text-ink">{t("جاهز تبدأ المشاهدة؟", "Ready to start watching?")}</h2>
            <p className="mt-2 text-base leading-7 text-ink-2">
              {t("اختار باقتك، وتابع طلبك واشتراكك من حسابك.", "Pick your plan, then follow your order and subscription from your account.")}
            </p>
          </div>
          <LinkButton href="/plans" size="lg" className="shrink-0">
            {t("اختار باقتك", "Choose your plan")}
            <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
