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
import { toDate } from "@/src/lib/i18n";
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
 * customer strip → Spotlight hero → popular plans → Player → watch
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

  // Spotlight: the homepage carousel ads/announcements, highest priority first.
  const spotlight = announcements
    .filter((item) => item.placement === "HOME_CAROUSEL")
    .slice(0, 5)
    .map((item) => ({ id: item.id, title: item.title, description: item.description, ctaLabel: item.ctaLabel, ctaUrl: item.ctaUrl }));

  // Latest announcements: published announcements (not ads) that aren't
  // already in the spotlight or reserved for the dashboard, newest first.
  const spotlightIds = new Set(spotlight.map((item) => item.id));
  const latest: HomeAnnouncement[] = announcements
    .filter((item) => item.kind === "ANNOUNCEMENT" && item.placement !== "DASHBOARD" && !spotlightIds.has(item.id))
    .map((item) => ({ ...item, date: item.startsAt ?? item.createdAt }))
    .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      ctaLabel: item.ctaLabel,
      ctaUrl: item.ctaUrl,
      style: item.style,
      date: item.date,
    }));

  return (
    <>
      <HomeHero lang={lang} cheapest={cheapest} hours={hours} slides={spotlight}>
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
