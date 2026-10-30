import type { Metadata } from "next";

import { EditorialBoard } from "@/app/components/home/EditorialBoard";
import { HomeAnnouncements, type HomeAnnouncement } from "@/app/components/home/HomeAnnouncements";
import { HomeCustomerStrip } from "@/app/components/home/HomeCustomerStrip";
import { HomeDeviceCheck } from "@/app/components/home/HomeDeviceCheck";
import { HomePlanRail } from "@/app/components/home/HomePlanRail";
import { HomeAccountPreview, HomeCtaBand, HomeQuestions, HomeSteps } from "@/app/components/home/HomeSections";
import { HomeServiceCards } from "@/app/components/home/HomeServiceCards";
import { HomeStage, type StageServices } from "@/app/components/home/HomeStage";
import { HomeVipLaunch } from "@/app/components/home/HomeVipLaunch";
import s from "@/app/components/home/home.module.css";
import { getSessionUser } from "@/src/server/auth";
import {
  getActiveApps,
  getActiveDevices,
  getActivePackages,
  platformName,
  platformsOf,
  type CatalogDevice,
  type CatalogPackage,
} from "@/src/server/catalog";
import { getLiveAnnouncements } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";
import { editorialItems, getViewer, latestItems } from "@/src/server/promotions";

export const dynamic = "force-dynamic";

const TITLE = "شاشتنا | اشتراكاتك الترفيهية بمكان واحد";
const DESCRIPTION =
  "اشتراكات IPTV وVIP بأسعار واضحة، تطبيق Shashtna Player لأندرويد وأندرويد TV، وأجهزة VIP — وحساب تتابع منه طلبك واشتراكك وتجديده والدعم الفني.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { title: TITLE, description: DESCRIPTION },
};

// The VIP picture when no device has one of its own (Shashtna's VIP art).
const VIP_ART = "/brand/vip-art.jpg";

/**
 * Homepage: customer strip → stage (headline, the ad on a TV, live prices) →
 * the three services → offers and news → IPTV plans → VIP launch → device
 * check → how it works → the account → latest announcements → FAQ → closing
 * band. Every price, plan, device and platform comes from the catalogue; a
 * section without data is left out.
 */
export default async function HomePage() {
  const [{ lang }, user, packages, apps, devices, announcements] = await Promise.all([
    getI18n(),
    getSessionUser().catch(() => null),
    getActivePackages().catch(() => [] as CatalogPackage[]),
    getActiveApps().catch(() => []),
    getActiveDevices().catch(() => [] as CatalogDevice[]),
    getLiveAnnouncements("WEBSITE").catch(() => []),
  ]);

  const iptv = packages.filter((pkg) => pkg.serviceType === "IPTV");
  const vip = packages.filter((pkg) => pkg.serviceType === "VIP");
  const vipIds = new Set(vip.map((pkg) => pkg.id));
  const vipDevices = devices.filter((device) => device.packageIds.some((id) => vipIds.has(id)));

  // Lowest live prices per service for the stage (never written in code).
  const lowest = (prices: number[]) => (prices.length ? Math.min(...prices) : null);
  const services: StageServices = {
    iptvFrom: lowest(iptv.map((pkg) => pkg.price)),
    vipFrom: lowest(vip.map((pkg) => pkg.price)),
    vipDeviceFrom: lowest(vipDevices.map((device) => device.price)),
  };

  const platforms = platformsOf(apps).filter((item) => item.platform !== "—");
  const platformNames = platforms.map((item) => platformName(item.platform));
  const vipArt = vipDevices.find((device) => device.imageUrl)?.imageUrl ?? VIP_ART;

  const viewer = await getViewer(user);
  const editorial = editorialItems(announcements, viewer);
  const latest: HomeAnnouncement[] = latestItems(announcements, viewer, new Set(editorial.map((item) => item.id)));
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <HomeStage lang={lang} services={services} platforms={platformNames} vipArt={vipArt}>
        {user ? <HomeCustomerStrip user={user} /> : null}
      </HomeStage>

      <HomeServiceCards lang={lang} hasIptv={iptv.length > 0} hasVip={vip.length > 0} hasPlayer={apps.some((app) => app.isPlayer)} vipArt={vipArt} />

      {editorial.length ? (
        <section className={`${s.wrap} ${s.sectionTight}`} aria-label={t("عروض وأخبار شاشتنا", "Shashtna offers and news")}>
          <EditorialBoard
            items={editorial}
            labels={{
              region: t("عروض وأخبار شاشتنا", "Shashtna offers and news"),
              kinds: { AD: t("إعلان", "Ad"), OFFER: t("عرض", "Offer"), NEWS: t("خبر", "News"), ANNOUNCEMENT: t("إعلان مهم", "Announcement") },
              previous: t("السابق", "Previous"),
              next: t("التالي", "Next"),
            }}
          />
        </section>
      ) : null}

      <HomePlanRail
        lang={lang}
        plans={iptv.map((pkg) => ({ id: pkg.id, name: pkg.name, slug: pkg.slug, price: pkg.price, durationMonths: pkg.durationMonths, imageUrl: pkg.imageUrl, options: pkg.options }))}
      />

      <HomeVipLaunch
        lang={lang}
        vipArt={VIP_ART}
        plans={vip.map((pkg) => ({ id: pkg.id, name: pkg.name, slug: pkg.slug, price: pkg.price, renewalPrice: pkg.renewalPrice, durationMonths: pkg.durationMonths }))}
        devices={vipDevices.map((device) => ({ id: device.id, name: device.name, price: device.price, packageIds: device.packageIds, imageUrl: device.imageUrl }))}
      />

      <HomeDeviceCheck
        lang={lang}
        platforms={platforms.map((item) => ({
          platform: item.platform,
          apps: item.apps.map((app) => ({ name: app.name, slug: app.slug, instructions: app.instructions })),
        }))}
      />

      <HomeSteps lang={lang} />
      <HomeAccountPreview lang={lang} signedIn={Boolean(user)} />
      {latest.length ? (
        <div className={s.sectionTight}>
          <HomeAnnouncements lang={lang} items={latest} />
        </div>
      ) : null}
      <HomeQuestions lang={lang} />
      <HomeCtaBand lang={lang} />
    </div>
  );
}
