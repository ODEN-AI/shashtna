import type { Metadata } from "next";
import Link from "next/link";

import s from "@/app/components/home/home.module.css";
import { PlanCards } from "@/app/components/plans/PlanCards";
import { LinkButton } from "@/app/ui/Button";
import { EmptyState, ErrorState } from "@/app/ui/States";
import { FAQ } from "@/src/content/help";
import { formatPrice } from "@/src/lib/i18n";
import { getActiveDevices, getActivePackages, type CatalogDevice, type CatalogPackage } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الباقات",
  description: "باقات شاشتنا IPTV وVIP بأسعار ومدد واضحة. اختار باقتك وأكمل طلبك بخطوات بسيطة.",
  alternates: { canonical: "/plans" },
};

// The VIP picture when a VIP package has no image of its own.
const VIP_ART = "/brand/vip-art.jpg";

function positiveId(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/** Cheapest active device compatible with each VIP package (display only). */
function cheapestDeviceByPackage(devices: CatalogDevice[]) {
  const cheapest = new Map<number, number>();

  for (const device of devices) {
    for (const packageId of device.packageIds) {
      const current = cheapest.get(packageId);
      if (current === undefined || device.price < current) cheapest.set(packageId, device.price);
    }
  }

  return cheapest;
}

/**
 * The plans page in the site's navy direction. IPTV and VIP are separate
 * services, so each has its own chapter and its own cards, never mixed.
 * Every name, image, price and duration comes from the catalogue.
 */
export default async function PlansPage({ searchParams }: { searchParams: Promise<{ renew?: string; upgrade?: string }> }) {
  const [{ t, lang }, params] = await Promise.all([getI18n(), searchParams]);
  // A card opens the plan's details, whose "Subscribe now" goes to checkout.
  // Renewals and upgrades start on the subscription page and pick the plan
  // here; both carry through to checkout (which checks ownership).
  const renewId = positiveId(params.renew);
  const upgradeId = positiveId(params.upgrade);
  const detailsHref = (pkg: CatalogPackage) =>
    `/plans/${encodeURIComponent(pkg.slug)}${renewId ? `?renew=${renewId}` : upgradeId ? `?upgrade=${upgradeId}` : ""}`;

  let packages: CatalogPackage[] | null = null;
  let devices: CatalogDevice[] = [];

  try {
    [packages, devices] = await Promise.all([getActivePackages(), getActiveDevices()]);
  } catch (error) {
    console.error("PLANS_PAGE_ERROR:", error);
  }

  const iptv = packages?.filter((pkg) => pkg.serviceType === "IPTV") ?? [];
  const vip = packages?.filter((pkg) => pkg.serviceType === "VIP") ?? [];
  const deviceFrom = cheapestDeviceByPackage(devices);
  const paymentFaq = FAQ.filter((item) => item.topic === "payment" || item.id === "activation");
  const lowest = (list: CatalogPackage[]) => (list.length ? Math.min(...list.map((pkg) => pkg.price)) : null);
  const card = (pkg: CatalogPackage) => ({
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    price: pkg.price,
    renewalPrice: pkg.renewalPrice,
    durationMonths: pkg.durationMonths,
    imageUrl: pkg.imageUrl,
    href: detailsHref(pkg),
    deviceFrom: deviceFrom.get(pkg.id) ?? null,
  });

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <section className={s.wrap} aria-labelledby="plans-title">
        <div className={s.pageHead}>
          <p className={s.kicker}>{t("الباقات والأسعار", "Plans and prices")}</p>
          <h1 id="plans-title" className={s.h1}>
            {t("اختار باقتك", "Choose your plan")}
          </h1>
          <p className={`${s.lead} ${s.heroLead}`}>
            {t(
              "عدنا خدمتين منفصلتين: IPTV تشتغل على جهازك الحالي، وVIP تجي ويا جهاز مخصص. كل الأسعار بالدينار العراقي، والسعر اللي تشوفه هو اللي تحوّله.",
              "We offer two separate services: IPTV runs on the device you already have, and VIP comes with a dedicated device. All prices are in Iraqi dinars, and the price you see is what you transfer.",
            )}
          </p>
          {renewId || upgradeId ? (
            <p className={s.notice} role="status">
              {upgradeId
                ? t("اختار الباقة الجديدة لترقية اشتراكك.", "Choose the new plan for your upgrade.")
                : t("اختار مدة التجديد لاشتراكك.", "Choose the renewal plan for your subscription.")}
            </p>
          ) : null}
          {iptv.length && vip.length ? (
            <nav className={s.serviceSwitch} aria-label={t("الخدمات", "Services")}>
              <a href="#iptv" className={s.pricePill}>
                <span className={`${s.priceTag} nums`}>{t(`من ${formatPrice(lowest(iptv) ?? 0, lang)}`, `From ${formatPrice(lowest(iptv) ?? 0, lang)}`)}</span>
                <span>
                  <b>IPTV</b>
                  <small>{t("على جهازك الحالي", "On the device you have")}</small>
                </span>
              </a>
              <a href="#vip" className={s.pricePill}>
                <span className={`${s.priceTag} ${s.priceTagVip} nums`}>{t(`من ${formatPrice(lowest(vip) ?? 0, lang)}`, `From ${formatPrice(lowest(vip) ?? 0, lang)}`)}</span>
                <span>
                  <b>VIP</b>
                  <small>{t("ويا جهاز مخصص", "With a dedicated device")}</small>
                </span>
              </a>
            </nav>
          ) : null}
        </div>
      </section>

      {packages === null ? (
        <div className={`${s.wrap} ${s.section}`}>
          <ErrorState
            title={t("تعذر تحميل الباقات", "Plans couldn't be loaded")}
            description={t("صار خطأ مؤقت. حدّث الصفحة بعد شوية.", "A temporary error occurred. Refresh the page shortly.")}
            action={<LinkButton href="/plans" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
          />
        </div>
      ) : packages.length === 0 ? (
        <div className={`${s.wrap} ${s.section}`}>
          <EmptyState
            title={t("ماكو باقات منشورة حاليًا", "No plans are published right now")}
            description={t("راح تظهر الباقات هنا أول ما تنشر.", "Plans will appear here as soon as they're published.")}
            action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
          />
        </div>
      ) : (
        <>
          {iptv.length ? (
            <section id="iptv" aria-labelledby="iptv-heading" className={`${s.wrap} scroll-mt-24`} style={{ marginTop: 28 }}>
              <div className={`${s.chapter} ${s.chapterIptv}`}>
                <div className={s.chapterHead}>
                  <div>
                    <h2 id="iptv-heading" className={s.chapterTitle}>
                      IPTV
                    </h2>
                    <p className={s.lead} style={{ marginTop: 14 }}>
                      {t(
                        "قنوات وأفلام ومسلسلات على التلفزيون أو الموبايل اللي عندك. بعد التفعيل تستلم اسم مستخدم وكلمة مرور بحسابك.",
                        "Channels, films and series on the TV or phone you already have. After activation you get a username and password in your account.",
                      )}
                    </p>
                  </div>
                </div>
                <PlanCards lang={lang} service="IPTV" plans={iptv.map(card)} vipArt={VIP_ART} />
              </div>
            </section>
          ) : null}

          {vip.length ? (
            <section id="vip" aria-labelledby="vip-heading" className={`${s.wrap} scroll-mt-24`} style={{ marginTop: 28 }}>
              <div className={`${s.chapter} ${s.chapterVip}`}>
                <div className={s.chapterHead}>
                  <div>
                    <h2 id="vip-heading" className={`${s.chapterTitle} ${s.gold}`}>
                      VIP
                    </h2>
                    <p className={s.lead} style={{ marginTop: 14 }}>
                      {t(
                        "باقة ويا جهاز VIP مخصص تختاره عند الطلب. سعر الطلب يشمل الباقة والجهاز، والتجديد بعدين بدون جهاز.",
                        "A plan with a dedicated VIP device you pick when ordering. The order covers the plan and the device; later renewals need no device.",
                      )}
                    </p>
                  </div>
                  <Link href="/devices" className={`${s.btn} ${s.btnGhost}`}>
                    {t("شوف أجهزة VIP", "See VIP devices")}
                  </Link>
                </div>
                <PlanCards lang={lang} service="VIP" plans={vip.map(card)} vipArt={VIP_ART} />
              </div>
            </section>
          ) : null}

          {paymentFaq.length ? (
            <section className={`${s.wrap} ${s.section}`} aria-labelledby="pay-heading">
              <p className={s.kicker}>{t("قبل ما تطلب", "Before you order")}</p>
              <h2 id="pay-heading" className={s.h2}>
                {t("الدفع والتفعيل", "Payment and activation")}
              </h2>
              <div className={s.infoGrid}>
                {paymentFaq.map((item) => (
                  <div key={item.id} className={`${s.card} ${s.infoCard}`}>
                    <h3>{item.q[lang]}</h3>
                    <p>{item.a[lang]}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
