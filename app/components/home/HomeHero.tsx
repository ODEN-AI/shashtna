import Link from "next/link";
import { ArrowLeft, MonitorPlay } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Container } from "@/app/ui/Page";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";
import type { EditorialItem, ShowcaseScene } from "@/src/server/promotions";

import { EditorialBoard } from "./EditorialBoard";
import { ProductShowcase, type SceneDuration } from "./ProductShowcase";

/** Lowest published prices per service (null when the service has no active package). */
export type HeroServices = { iptvFrom: number | null; vipFrom: number | null; vipDeviceFrom: number | null };

/**
 * Hero: a short headline, one primary action, and the two services side by
 * side (IPTV on cobalt, VIP on warm black with champagne) with their lowest
 * live prices, so both are visible in the first phone screen. Below, the
 * product showcase (live catalogue, changed by the visitor) and, when the
 * team has published any, the editorial board. Every price comes from the
 * catalogue; a service without packages is left out.
 */
export function HomeHero({
  lang,
  services,
  scenes,
  durations,
  editorial,
  children,
}: {
  lang: Lang;
  services: HeroServices;
  scenes: ShowcaseScene[];
  durations: Record<string, SceneDuration>;
  editorial: EditorialItem[];
  children?: React.ReactNode;
}) {
  const t = translator(lang);
  const { iptvFrom, vipFrom, vipDeviceFrom } = services;

  return (
    // -mt-16/pt-16: the backdrop runs up behind the transparent header.
    <section className="bg-cinema relative -mt-16 overflow-hidden pt-16">
      {/* Signed-in customer strip sits at the top of the hero. */}
      {children}
      <Container className="pb-14 pt-8 lg:pb-20 lg:pt-14">
        <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
          <div className="animate-fade-up">
            <h1 className="text-balance text-display font-bold text-ink">{t("قنواتك وأفلامك باشتراك واحد", "Your channels and films, one subscription")}</h1>
            <p className="mt-4 max-w-xl text-pretty text-lead text-ink-2">
              {t(
                "اختار باقتك، حوّل المبلغ، وفريقنا يفعّل اشتراكك وتلگى بياناته بحسابك.",
                "Pick a plan, transfer the amount, and our team activates it; the details appear in your account.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <LinkButton href="/plans" size="lg">
                {t("اختار باقتك", "Choose your plan")}
                <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
              </LinkButton>
              <Link href="/watch/player" className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink">
                <MonitorPlay size={17} aria-hidden />
                Shashtna Player
              </Link>
            </div>
          </div>

          {iptvFrom !== null || vipFrom !== null ? (
            <ul className={cn("grid gap-3 animate-fade-up [animation-delay:80ms]", iptvFrom !== null && vipFrom !== null && "grid-cols-2")} data-testid="hero-services">
              {iptvFrom !== null ? (
                <li>
                  <Link
                    href="/plans#iptv"
                    className="flex h-full flex-col rounded-panel bg-iptv p-4 text-white transition-colors hover:bg-iptv-deep sm:p-5"
                  >
                    <span className="text-2xl font-black leading-none">IPTV</span>
                    <span className="mt-1.5 text-sm text-iptv-ink">{t("على جهازك الحالي", "On the device you have")}</span>
                    <span className="mt-auto pt-4 text-sm text-iptv-ink">
                      {t("من ", "From ")}
                      <span className="nums block text-xl font-black text-white">{formatPrice(iptvFrom, lang)}</span>
                    </span>
                  </Link>
                </li>
              ) : null}
              {vipFrom !== null ? (
                <li>
                  <Link
                    href="/plans#vip"
                    className="flex h-full flex-col rounded-panel border border-vip-line bg-vip-field p-4 text-vip transition-colors hover:bg-vip-soft sm:p-5"
                  >
                    <span className="text-2xl font-black leading-none">VIP</span>
                    <span className="mt-1.5 text-sm text-vip-text">{t("ويا جهاز مخصص", "With a dedicated device")}</span>
                    <span className="mt-auto pt-4 text-sm text-vip-text">
                      {t("من ", "From ")}
                      <span className="nums block text-xl font-black text-vip">{formatPrice(vipFrom, lang)}</span>
                      {vipDeviceFrom !== null ? (
                        <span className="nums block text-xs">
                          {t(`+ جهاز من ${formatPrice(vipDeviceFrom, lang)}`, `+ device from ${formatPrice(vipDeviceFrom, lang)}`)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {/* Media row: the two boards share height and frame language. */}
        <div
          data-testid="hero-boards"
          className={cn("mt-10 grid gap-5 animate-fade-up [animation-delay:160ms]", editorial.length ? "lg:grid-cols-[1.45fr_1fr]" : "")}
        >
          <ProductShowcase
            scenes={scenes}
            durations={durations}
            labels={{
              region: t("عرض منتجات شاشتنا", "Shashtna product showcase"),
              previous: t("السابق", "Previous"),
              next: t("التالي", "Next"),
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
