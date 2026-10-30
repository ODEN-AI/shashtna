import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { translator, type Lang } from "@/src/lib/i18n";

import s from "./home.module.css";

/**
 * The three ways to watch, each its own product: IPTV, VIP and the Shashtna
 * Player, each with its own picture. A card is shown only when its service
 * exists in the catalogue.
 */
export function HomeServiceCards({
  lang,
  hasIptv,
  hasVip,
  hasPlayer,
}: {
  lang: Lang;
  hasIptv: boolean;
  hasVip: boolean;
  hasPlayer: boolean;
}) {
  const t = translator(lang);
  const more = (label: string) => (
    <span className={s.serviceMore}>
      {label}
      <span aria-hidden>
        <ArrowLeft size={18} className="ltr:rotate-180" />
      </span>
    </span>
  );

  if (!hasIptv && !hasVip && !hasPlayer) {
    return null;
  }

  return (
    <section className={`${s.wrap} ${s.section}`} aria-labelledby="home-services-title">
      <p className={s.kicker}>{t("خدماتنا", "Our services")}</p>
      <h2 id="home-services-title" className={s.h2}>
        {t("ثلاث طرق تشاهد بيها", "Three ways to watch")}
      </h2>
      <div className={s.services}>
        {hasIptv ? (
          <Link href="/plans#iptv" className={`${s.card} ${s.cardLink} ${s.service}`}>
            <span className={`${s.serviceArt} ${s.artFill}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/home-iptv.webp" alt="" width={1200} height={800} loading="lazy" />
            </span>
            <h3>IPTV</h3>
            <p>
              {t(
                "اشتراك تستخدمه على التلفزيون أو الموبايل اللي عندك. تستلم اسم مستخدم وكلمة مرور بعد التفعيل.",
                "A subscription for the TV or phone you already have. You get a username and password once it is active.",
              )}
            </p>
            {more(t("شوف الباقات", "See the plans"))}
          </Link>
        ) : null}
        {hasVip ? (
          <Link href="/devices" className={`${s.card} ${s.cardLink} ${s.service}`}>
            <span className={`${s.serviceArt} ${s.artFill}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/home-vip.webp" alt="" width={1200} height={800} loading="lazy" />
            </span>
            <h3>VIP</h3>
            <p>
              {t(
                "جهاز مخصص يرتبط باشتراكك، وسعر الطلب يشمل الباقة والجهاز.",
                "A dedicated device linked to your subscription; the order price covers the plan and the device.",
              )}
            </p>
            {more(t("أجهزة VIP", "VIP devices"))}
          </Link>
        ) : null}
        {hasPlayer ? (
          <Link href="/watch/player" className={`${s.card} ${s.cardLink} ${s.service}`}>
            <span className={`${s.serviceArt} ${s.artWhole}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/home-player.webp" alt="" width={1600} height={900} loading="lazy" />
            </span>
            <h3>Shashtna Player</h3>
            <p>
              {t(
                "المشغل الرسمي لشاشتنا، مصمم لأندرويد وأندرويد TV. حمّله، سجّل دخولك، وابدأ.",
                "Shashtna's official player, built for Android and Android TV. Install it, sign in and start watching.",
              )}
            </p>
            {more(t("التطبيقات", "Apps"))}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
