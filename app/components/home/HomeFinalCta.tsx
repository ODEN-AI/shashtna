import { MonitorPlay } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { LogoMark } from "@/app/ui/Logo";
import { Container } from "@/app/ui/Page";
import { translator, type Lang } from "@/src/lib/i18n";

export function HomeFinalCta({ lang, signedIn }: { lang: Lang; signedIn: boolean }) {
  const t = translator(lang);

  return (
    <section className="pb-20">
      <Container>
        <div className="bg-brand-band edge-light relative overflow-hidden rounded-panel border border-white/10 px-6 py-12 text-center shadow-float sm:px-12 sm:py-16">
          <LogoMark className="mx-auto h-12 w-12" />
          <h2 className="mx-auto mt-5 max-w-2xl text-balance text-h2 font-bold text-white">
            {t("جاهز تبدأ المشاهدة؟", "Ready to start watching?")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-8 text-white/80">
            {t("اختار باقتك، وتابع طلبك واشتراكك من حسابك.", "Pick your plan, then follow your order and subscription from your account.")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/plans" variant="glow" size="lg">
              {t("اختر باقتك", "Choose a plan")}
            </LinkButton>
            <LinkButton href="/watch/player" variant="glass" size="lg">
              <MonitorPlay size={18} aria-hidden />
              {t("اكتشف Shashtna Player", "Explore Shashtna Player")}
            </LinkButton>
            {!signedIn ? (
              <LinkButton href="/register" variant="glass" size="lg">
                {t("إنشاء حساب", "Create account")}
              </LinkButton>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
