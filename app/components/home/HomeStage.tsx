import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { formatPrice, translator, type Lang } from "@/src/lib/i18n";

import s from "./home.module.css";

/** Lowest published prices per service (null when the service has no active package). */
export type StageServices = { iptvFrom: number | null; vipFrom: number | null; vipDeviceFrom: number | null };

/**
 * First screen: the headline and the one action beside a TV that plays
 * Shashtna's own ad, with the lowest live price of each service. Floating
 * cards carry three real facts: manual transfer, the platforms in the apps
 * catalogue, and the cheapest VIP device. Anything without data is left out.
 */
export function HomeStage({
  lang,
  services,
  platforms,
  vipArt,
  children,
}: {
  lang: Lang;
  services: StageServices;
  platforms: string[];
  vipArt: string;
  children?: React.ReactNode;
}) {
  const t = translator(lang);
  const { iptvFrom, vipFrom, vipDeviceFrom } = services;

  return (
    <section className={s.wrap} aria-labelledby="home-title">
      {children}
      <div className={s.stage} data-testid="home-stage">
        <div className={s.ghostWord} aria-hidden>
          {t("شاشتنا", "Shashtna")}
        </div>

        <div className={s.heroText}>
          <p className={s.kicker}>{t("اشتراكات IPTV وVIP بالعراق", "IPTV and VIP subscriptions in Iraq")}</p>
          <h1 id="home-title" className={s.h1}>
            {t("قنواتك وأفلامك", "Your channels and films,")}
            <br />
            <span className={s.hl}>{t("بشاشة وحدة", "on one screen")}</span>
          </h1>
          <p className={`${s.lead} ${s.heroLead}`}>
            {t(
              "اختار باقتك، حوّل المبلغ، وفريقنا يفعّل اشتراكك وتلگى بياناته بحسابك. كل شي بالدينار العراقي.",
              "Pick a plan, transfer the amount, and our team activates it; the details appear in your account. Prices are in Iraqi dinars.",
            )}
          </p>
          <div className={s.heroActions}>
            <Link href="/plans" className={`${s.btn} ${s.btnPrimary}`}>
              {t("اختار باقتك", "Choose your plan")}
              <span className={s.btnArrow} aria-hidden>
                <ArrowLeft size={18} className="ltr:rotate-180" />
              </span>
            </Link>
            <Link href="#devices" className={`${s.btn} ${s.btnGhost}`}>
              {t("هل جهازي مدعوم؟", "Is my device supported?")}
            </Link>
          </div>

          {iptvFrom !== null || vipFrom !== null ? (
            <div className={s.pricePills} data-testid="hero-services">
              {iptvFrom !== null ? (
                <Link href="/plans#iptv" className={s.pricePill}>
                  <span className={`${s.priceTag} nums`}>{t(`من ${formatPrice(iptvFrom, lang)}`, `From ${formatPrice(iptvFrom, lang)}`)}</span>
                  <span>
                    <b>IPTV</b>
                    <small>{t("على جهازك الحالي", "On the device you have")}</small>
                  </span>
                </Link>
              ) : null}
              {vipFrom !== null ? (
                <Link href="/plans#vip" className={s.pricePill}>
                  <span className={`${s.priceTag} ${s.priceTagVip} nums`}>{t(`من ${formatPrice(vipFrom, lang)}`, `From ${formatPrice(vipFrom, lang)}`)}</span>
                  <span>
                    <b>VIP</b>
                    <small>{t("ويا جهاز مخصص", "With a dedicated device")}</small>
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={s.tvWrap}>
          <div className={s.tv}>
            <div className={s.tvScreen}>
              <video
                src="/videos/shashtna-ad-web.mp4"
                poster="/videos/shashtna-ad-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={t("إعلان شاشتنا", "Shashtna ad")}
              />
            </div>
          </div>
          <div className={s.tvStand} aria-hidden />

          <div className={`${s.float} ${s.floatA}`}>
            <span className={s.floatIcon} aria-hidden>
              <ShieldCheck size={22} />
            </span>
            <span>
              <small>{t("الدفع", "Payment")}</small>
              <b>{t("تحويل يدوي آمن", "Secure manual transfer")}</b>
            </span>
          </div>
          {platforms.length ? (
            <div className={`${s.float} ${s.floatC}`}>
              <small>{t("يشتغل على", "Works on")}</small>
              <b dir="ltr">{platforms.join(" · ")}</b>
            </div>
          ) : null}
          {vipDeviceFrom !== null ? (
            <div className={`${s.float} ${s.floatB}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={vipArt} alt="" width={60} height={60} />
              <span>
                <small>{t("جهاز VIP", "VIP device")}</small>
                <b className="nums">{t(`من ${formatPrice(vipDeviceFrom, lang)}`, `From ${formatPrice(vipDeviceFrom, lang)}`)}</b>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
