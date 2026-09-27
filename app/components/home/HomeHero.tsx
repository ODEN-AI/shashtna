import { ArrowLeft, Clock3, MonitorPlay, PackageCheck, Wallet } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Container, Eyebrow } from "@/app/ui/Page";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";
import type { EditorialItem, ShowcaseScene } from "@/src/server/promotions";

import { EditorialBoard } from "./EditorialBoard";
import { ProductShowcase } from "./ProductShowcase";

/**
 * Hero: the headline row, then the media row with two boards —
 * board 1, the Animated Product Showcase (live catalogue), and board 2, the
 * editorial board (admin ads / offers / news). The chips are facts from real
 * data (lowest published price, order tracking, support hours from
 * Settings) and are omitted when the data is missing.
 */
export function HomeHero({
  lang,
  cheapest,
  hours,
  scenes,
  editorial,
  children,
}: {
  lang: Lang;
  cheapest: number | null;
  hours: string;
  scenes: ShowcaseScene[];
  editorial: EditorialItem[];
  children?: React.ReactNode;
}) {
  const t = translator(lang);

  return (
    // -mt-16/pt-16: the spotlight backdrop runs up behind the transparent header.
    <section className="bg-cinema relative -mt-16 overflow-hidden pt-16">
      {/* Signed-in customer strip sits on the spotlight backdrop. */}
      {children}
      <Container className="pb-14 pt-10 lg:pb-20 lg:pt-14">
        <div className="grid items-end gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="animate-fade-up">
            <Eyebrow>IPTV · VIP · Shashtna Player</Eyebrow>
            <h1 className="mt-4 text-balance text-display font-bold text-ink">
              {t("قنواتك وأفلامك ومسلسلاتك،", "Your channels, films and series,")}{" "}
              <span className="text-gradient">{t("باشتراك واحد واضح", "in one clear subscription")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lead text-ink-2">
              {t(
                "اختار باقتك، أكمل طلبك بخطوات بسيطة، وتابع اشتراكك وتجديده من حسابك — وشغّل كلشي على Shashtna Player.",
                "Pick a plan, complete your order in a few simple steps, and manage your subscription and renewals from your account — then watch on Shashtna Player.",
              )}
            </p>
          </div>
          <div className="animate-fade-up [animation-delay:100ms] lg:pb-2">
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <LinkButton href="#plans" size="lg">
                {t("شوف الباقات", "See plans")}
                <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
              </LinkButton>
              <LinkButton href="/watch/player" variant="glass" size="lg">
                <MonitorPlay size={18} aria-hidden />
                Shashtna Player
              </LinkButton>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2.5 text-sm text-ink-2 lg:justify-end">
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
        </div>

        {/* Media row: the two boards share height and frame language. */}
        <div
          data-testid="hero-boards"
          className={cn("mt-10 grid gap-5 animate-fade-up [animation-delay:160ms]", editorial.length ? "lg:grid-cols-[1.45fr_1fr]" : "")}
        >
          <ProductShowcase
            scenes={scenes}
            labels={{
              region: t("عرض منتجات شاشتنا", "Shashtna product showcase"),
              pause: t("إيقاف العرض مؤقتًا", "Pause showcase"),
              play: t("تشغيل العرض", "Play showcase"),
              scene: t("شاشتنا", "Shashtna"),
              currency: t("د.ع", "IQD"),
            }}
          />
          {editorial.length ? (
            <EditorialBoard
              items={editorial}
              labels={{
                region: t("عروض وأخبار شاشتنا", "Shashtna offers and news"),
                kinds: { AD: t("إعلان", "Ad"), OFFER: t("عرض", "Offer"), NEWS: t("خبر", "News"), ANNOUNCEMENT: t("إعلان مهم", "Announcement") },
                previous: t("السابق", "Previous"),
                next: t("التالي", "Next"),
              }}
            />
          ) : null}
        </div>
      </Container>
    </section>
  );
}
