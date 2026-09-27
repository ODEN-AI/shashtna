import type { Metadata } from "next";

import { HomeAnnouncements, type HomeAnnouncement } from "@/app/components/home/HomeAnnouncements";
import { HomeCustomerStrip } from "@/app/components/home/HomeCustomerStrip";
import { HomeDevices } from "@/app/components/home/HomeDevices";
import { HomeFaq } from "@/app/components/home/HomeFaq";
import { HomeFinalCta } from "@/app/components/home/HomeFinalCta";
import { HomeHero } from "@/app/components/home/HomeHero";
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
 * customer strip → hero (animated product showcase + editorial board) → popular plans → Player → watch
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

  const cheapest = packages.length ? Math.min(...packages.map((pkg) => pkg.price)) : null;
  const hours = isAr ? settings["support.hours"] : settings["support.hoursEn"];

  const viewer = await getViewer(user);
  const scenes = buildShowcaseScenes({ packages, devices, apps, lang });
  const editorial = editorialItems(announcements, viewer);
  const latest: HomeAnnouncement[] = latestItems(announcements, viewer, new Set(editorial.map((item) => item.id)));

  return (
    <>
      <HomeHero lang={lang} cheapest={cheapest} hours={hours} scenes={scenes} editorial={editorial}>
        {user ? <HomeCustomerStrip user={user} /> : null}
      </HomeHero>
      <HomePlans lang={lang} packages={packages} />
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
