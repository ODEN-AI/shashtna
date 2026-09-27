import { ArrowLeft, Clock3, MonitorPlay, PackageCheck, Wallet } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { Container, Eyebrow } from "@/app/ui/Page";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";

import { HomeSpotlight, type SpotlightSlide } from "./HomeSpotlight";

/**
 * Hero + Spotlight. The facts in the chips come from real data: the lowest
 * published plan price, the order tracking every order has, and the support
 * hours from Settings. Nothing is shown when the data is missing.
 */
export function HomeHero({
  lang,
  cheapest,
  hours,
  slides,
  children,
}: {
  lang: Lang;
  cheapest: number | null;
  hours: string;
  slides: SpotlightSlide[];
  children?: React.ReactNode;
}) {
  const t = translator(lang);

  return (
    // -mt-16/pt-16: the spotlight backdrop runs up behind the transparent header.
    <section className="bg-cinema relative -mt-16 overflow-hidden pt-16">
      {/* Signed-in customer strip sits on the spotlight backdrop. */}
      {children}
      <Container className="grid items-center gap-12 py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-20">
        <div className="animate-fade-up">
          <Eyebrow>IPTV · VIP · Shashtna Player</Eyebrow>
          <h1 className="mt-5 text-balance text-display font-bold text-ink">
            {t("قنواتك وأفلامك ومسلسلاتك،", "Your channels, films and series,")}{" "}
            <span className="text-gradient">{t("باشتراك واحد واضح", "in one clear subscription")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lead text-ink-2">
            {t(
              "اختار باقتك، أكمل طلبك بخطوات بسيطة، وتابع اشتراكك وتجديده من حسابك — وشغّل كلشي على Shashtna Player.",
              "Pick a plan, complete your order in a few simple steps, and manage your subscription and renewals from your account — then watch on Shashtna Player.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="#plans" size="lg">
              {t("شوف الباقات", "See plans")}
              <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
            </LinkButton>
            <LinkButton href="/watch/player" variant="glass" size="lg">
              <MonitorPlay size={18} aria-hidden />
              Shashtna Player
            </LinkButton>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2.5 text-sm text-ink-2">
            {cheapest !== null ? (
              <li className="glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-2">
                <Wallet size={15} className="text-glow" aria-hidden />
                {t("تبدأ من ", "From ")}
                <span className="nums font-bold text-ink">{formatPrice(cheapest, lang)}</span>
              </li>
            ) : null}
            <li className="glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-2">
              <PackageCheck size={15} className="text-glow" aria-hidden />
              {t("تتبّع طلبك خطوة بخطوة", "Track your order step by step")}
            </li>
            {hours ? (
              <li className="glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-2">
                <Clock3 size={15} className="text-glow" aria-hidden />
                {t("دعم ", "Support ")}
                {hours}
              </li>
            ) : null}
          </ul>
        </div>

        <div className="animate-fade-up [animation-delay:120ms]">
          <HomeSpotlight
            slides={slides}
            labels={{
              video: t("إعلان شاشتنا", "Shashtna promo video"),
              region: t("إعلانات شاشتنا", "Shashtna announcements"),
              previous: t("السابق", "Previous"),
              next: t("التالي", "Next"),
              play: t("تشغيل الفيديو", "Play video"),
              pause: t("إيقاف الفيديو مؤقتًا", "Pause video"),
              brand: t(
                "باقات IPTV وVIP، وتطبيق Shashtna Player، وحساب يتابع طلبك واشتراكك.",
                "IPTV and VIP plans, the Shashtna Player app and an account that follows your order and plan.",
              ),
            }}
          />
        </div>
      </Container>
    </section>
  );
}
