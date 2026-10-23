import type { Metadata } from "next";

import { HomeAnnouncements, type HomeAnnouncement } from "@/app/components/home/HomeAnnouncements";
import { HomeCustomerStrip } from "@/app/components/home/HomeCustomerStrip";
import { HomeDevices } from "@/app/components/home/HomeDevices";
import { HomeFaq } from "@/app/components/home/HomeFaq";
import { HomeFinalCta } from "@/app/components/home/HomeFinalCta";
import { HomeHero, type HeroServices } from "@/app/components/home/HomeHero";
import { HomeHowItWorks } from "@/app/components/home/HomeHowItWorks";
import { HomePlans } from "@/app/components/home/HomePlans";
import { HomePlayer } from "@/app/components/home/HomePlayer";
import { HomeWatchEverywhere } from "@/app/components/home/HomeWatchEverywhere";
import { getSessionUser } from "@/src/server/auth";
import {
  getActiveApps,
  getActiveDevices,
  getActivePackages,
  platformsOf,
  type CatalogDevice,
  type CatalogPackage,
} from "@/src/server/catalog";
import { getLiveAnnouncements } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";
import { buildShowcaseScenes, editorialItems, getViewer, latestItems } from "@/src/server/promotions";
import { getSettings } from "@/src/server/settings";

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

/**
 * Homepage — the web counterpart of Shashtna Mobile's home:
 * customer strip → hero (services, product showcase + editorial board) → popular plans → Player → watch
 * everywhere → VIP devices → how it works → latest announcements → FAQ →
 * final CTA. Every section renders real data (or nothing).
 */
export default async function HomePage() {
  const [{ lang, isAr }, user, packages, apps, devices, announcements, settings] = await Promise.all([
    getI18n(),
    getSessionUser().catch(() => null),
    getActivePackages().catch(() => [] as CatalogPackage[]),
    getActiveApps().catch(() => []),
    getActiveDevices().catch(() => [] as CatalogDevice[]),
    getLiveAnnouncements("WEBSITE").catch(() => []),
    getSettings(),
  ]);

  const hours = isAr ? settings["support.hours"] : settings["support.hoursEn"];

  // Lowest live prices per service for the hero (never written in code).
  const lowest = (prices: number[]) => (prices.length ? Math.min(...prices) : null);
  const vipIds = new Set(packages.filter((pkg) => pkg.serviceType === "VIP").map((pkg) => pkg.id));
  const services: HeroServices = {
    iptvFrom: lowest(packages.filter((pkg) => pkg.serviceType === "IPTV").map((pkg) => pkg.price)),
    vipFrom: lowest(packages.filter((pkg) => pkg.serviceType === "VIP").map((pkg) => pkg.price)),
    vipDeviceFrom: lowest(devices.filter((device) => device.packageIds.some((id) => vipIds.has(id))).map((device) => device.price)),
  };

  const viewer = await getViewer(user);
  const scenes = buildShowcaseScenes({ packages, devices, apps, lang });
  // Each package scene's own duration, so the showcase can skip lines that only repeat it.
  const durations = Object.fromEntries(
    packages.map((pkg) => [`package:${pkg.slug}`, { durationMonths: pkg.durationMonths, durationLabel: pkg.durationLabel }]),
  );
  const editorial = editorialItems(announcements, viewer);
  const latest: HomeAnnouncement[] = latestItems(announcements, viewer, new Set(editorial.map((item) => item.id)));

  return (
    <>
      <HomeHero lang={lang} services={services} scenes={scenes} durations={durations} editorial={editorial}>
        {user ? <HomeCustomerStrip user={user} /> : null}
      </HomeHero>
      <HomePlans lang={lang} packages={packages} devices={devices} />
      <HomePlayer lang={lang} hasPlayerApp={apps.some((app) => app.isPlayer)} />
      <HomeWatchEverywhere
        lang={lang}
        platforms={platformsOf(apps)}
        hasVip={packages.some((pkg) => pkg.serviceType === "VIP") || devices.length > 0}
      />
      <HomeDevices lang={lang} devices={devices} packages={packages} />
      <HomeHowItWorks lang={lang} />
      <HomeAnnouncements lang={lang} items={latest} />
      <HomeFaq lang={lang} settings={settings} hours={hours} />
      <HomeFinalCta lang={lang} signedIn={Boolean(user)} />
    </>
  );
}
