import { formatDate, formatPrice, toDate, translator, type Lang } from "@/src/lib/i18n";
import { orderStage } from "@/src/lib/order-journey";
import {
  audienceMatches,
  isMember,
  mediaOf,
  type EntryItem,
  type EntryPayload,
  type Viewer,
} from "@/src/lib/promotions";
import type { SessionUser } from "@/src/server/auth";
import {
  getActiveApps,
  getActiveDevices,
  getActivePackages,
  rankPopular,
  type CatalogApp,
  type CatalogDevice,
  type CatalogPackage,
} from "@/src/server/catalog";
import { getActiveIncidents, getLiveAnnouncements } from "@/src/server/content";
import { getCustomerOverview } from "@/src/server/overview";
import { proofUploadTimes } from "@/src/server/payment-proofs";

/**
 * Read-only builders for the homepage showcase, the editorial hero board and
 * the entry experiences. Everything comes from existing records (catalogue,
 * Admin → Ads & announcements, service incidents and the viewer's own
 * account). Nothing is written, and nothing is invented: a missing value is
 * left out.
 */

type Announcement = Awaited<ReturnType<typeof getLiveAnnouncements>>[number];

function monthly(pkg: CatalogPackage) {
  return pkg.durationMonths > 1 ? Math.round(pkg.price / pkg.durationMonths / 250) * 250 : null;
}

// ------------------------------------------------------------------ viewer

export async function getViewer(user: SessionUser | null): Promise<Viewer> {
  if (!user) {
    return { state: "GUEST", vip: false };
  }

  const overview = await getCustomerOverview(user.id).catch(() => null);

  if (!overview) {
    return { state: "NONE", vip: false };
  }

  return {
    state: overview.state,
    vip: String(overview.primary?.serviceType ?? "").toUpperCase() === "VIP",
  };
}

// ---------------------------------------------------------------- showcase

export type ShowcaseScene = {
  key: string;
  kind: "iptv" | "vip" | "device" | "player";
  eyebrow: string;
  title: string;
  subtitle: string | null;
  facts: string[];
  chips: string[];
  price: number | null;
  priceNote: string | null;
  imageUrl: string | null;
  video: { src: string; poster: string } | null;
  cta: { label: string; href: string };
};

function packageScene(pkg: CatalogPackage, lang: Lang): ShowcaseScene {
  const t = translator(lang);
  const perMonth = monthly(pkg);

  return {
    key: `package:${pkg.slug}`,
    kind: pkg.serviceType === "VIP" ? "vip" : "iptv",
    eyebrow: pkg.isPopular ? t("الأكثر طلبًا", "Most popular") : t(`باقة ${pkg.serviceType}`, `${pkg.serviceType} plan`),
    title: pkg.name,
    subtitle: pkg.description || null,
    facts: [pkg.durationLabel, ...pkg.features.slice(0, 2)],
    chips: pkg.features.slice(2, 4),
    price: pkg.price,
    priceNote: perMonth ? t(`≈ ${formatPrice(perMonth, lang)} شهريًا`, `≈ ${formatPrice(perMonth, lang)} / month`) : pkg.durationLabel,
    imageUrl: pkg.imageUrl,
    video: null,
    cta: { label: t("اشترك الآن", "Subscribe now"), href: `/checkout?plan=${encodeURIComponent(pkg.slug)}` },
  };
}

function deviceScene(device: CatalogDevice, packages: CatalogPackage[], lang: Lang): ShowcaseScene {
  const t = translator(lang);
  const compatible = packages.filter((pkg) => device.packageIds.includes(pkg.id));

  return {
    key: `device:${device.id}`,
    kind: "device",
    eyebrow: t("جهاز VIP", "VIP device"),
    title: device.name,
    subtitle: device.description || null,
    facts: device.features.slice(0, 3),
    chips: compatible.slice(0, 2).map((pkg) => pkg.name),
    price: device.price,
    priceNote: t("سعر الجهاز", "Device price"),
    imageUrl: device.imageUrl,
    video: null,
    cta: {
      label: t("اطلب الجهاز", "Order the device"),
      href: compatible[0] ? `/checkout?plan=${encodeURIComponent(compatible[0].slug)}&device=${device.id}` : `/checkout?device=${device.id}`,
    },
  };
}

function playerScene(apps: CatalogApp[], lang: Lang): ShowcaseScene {
  const t = translator(lang);
  const hasPlayer = apps.some((app) => app.isPlayer);

  return {
    key: "player",
    kind: "player",
    eyebrow: "Shashtna Player",
    title: t("المشغل الرسمي لشاشتنا", "The official Shashtna player"),
    subtitle: t("مصمم لأندرويد وأندرويد TV. حمّله، سجّل دخولك، وابدأ المشاهدة.", "Built for Android and Android TV. Install it, sign in and start watching."),
    facts: ["Android TV", "Android", t("بياناتك جاهزة للنسخ", "Details ready to copy")],
    chips: [t("روابط تحميل وخطوات إعداد", "Downloads and setup steps")],
    price: null,
    priceNote: null,
    imageUrl: null,
    video: { src: "/videos/shashtna-ad-web.mp4", poster: "/videos/shashtna-ad-poster.jpg" },
    cta: { label: hasPlayer ? t("تحميل Shashtna Player", "Get Shashtna Player") : t("عن Shashtna Player", "About Shashtna Player"), href: "/watch/player" },
  };
}

/** Package → Player → VIP device → (the other service's package), from live data. */
export function buildShowcaseScenes(input: { packages: CatalogPackage[]; devices: CatalogDevice[]; apps: CatalogApp[]; lang: Lang }) {
  const { packages, devices, apps, lang } = input;
  const lead = rankPopular(packages, 1)[0];
  const other = lead ? rankPopular(packages.filter((pkg) => pkg.serviceType !== lead.serviceType), 1)[0] : undefined;
  const scenes: ShowcaseScene[] = [];

  if (lead) scenes.push(packageScene(lead, lang));
  scenes.push(playerScene(apps, lang));
  if (devices[0]) scenes.push(deviceScene(devices[0], packages, lang));
  if (other) scenes.push(packageScene(other, lang));

  return scenes;
}

// ----------------------------------------------------------- editorial board

export type EditorialItem = {
  id: number;
  kind: string;
  title: string;
  description: string | null;
  highlight: string | null;
  mediaType: "IMAGE" | "VIDEO";
  imageUrl: string | null;
  videoUrl: string | null;
  cta: { label: string; href: string } | null;
};

function toEditorial(item: Announcement): EditorialItem {
  const media = mediaOf(item);

  return {
    id: item.id,
    kind: String(item.kind ?? "AD").toUpperCase(),
    title: item.title,
    description: item.description,
    highlight: item.highlight ?? null,
    mediaType: media.type,
    imageUrl: media.imageUrl,
    videoUrl: media.videoUrl,
    cta: item.ctaUrl && item.ctaLabel ? { label: item.ctaLabel, href: item.ctaUrl } : null,
  };
}

/**
 * The hero board's items: HERO_EDITORIAL records first, then the existing
 * homepage carousel ads, filtered by the viewer's audience. Live-ness and
 * scheduling are already applied by getLiveAnnouncements.
 */
export function editorialItems(announcements: Announcement[], viewer: Viewer, limit = 6) {
  const matches = (item: Announcement) => audienceMatches(item.audience, viewer);
  const board = announcements.filter((item) => item.placement === "HERO_EDITORIAL" && matches(item));
  const carousel = announcements.filter((item) => item.placement === "HOME_CAROUSEL" && matches(item));

  return [...board, ...carousel].slice(0, limit).map(toEditorial);
}

/** Latest list: HOME_LATEST records plus published news / announcements not used elsewhere. */
export function latestItems(announcements: Announcement[], viewer: Viewer, exclude: Set<number>, limit = 3) {
  const reserved = new Set(["HERO_EDITORIAL", "ENTRY_GUEST", "ENTRY_MEMBER", "DASHBOARD"]);

  return announcements
    .filter(
      (item) =>
        !exclude.has(item.id) &&
        audienceMatches(item.audience, viewer) &&
        (item.placement === "HOME_LATEST" || ((item.kind === "ANNOUNCEMENT" || item.kind === "NEWS") && !reserved.has(item.placement))),
    )
    .map((item) => ({ item, date: item.startsAt ?? item.createdAt }))
    .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0))
    .slice(0, limit)
    .map(({ item, date }) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      ctaLabel: item.ctaLabel,
      ctaUrl: item.ctaUrl,
      style: item.style,
      date,
    }));
}

// ---------------------------------------------------------------- entry

function adminEntry(item: Announcement, lang: Lang, member: boolean): EntryItem {
  const t = translator(lang);
  const media = mediaOf(item);
  const kind = String(item.kind ?? "AD").toUpperCase();
  const eyebrow =
    kind === "OFFER"
      ? member ? t("عرض للمشتركين", "Member offer") : t("عرض", "Offer")
      : kind === "NEWS"
        ? t("جديد من شاشتنا", "New from Shashtna")
        : kind === "ANNOUNCEMENT"
          ? t("تنبيه", "Update")
          : t("إعلان", "Ad");

  return {
    key: `admin:${item.id}`,
    source: "admin",
    eyebrow,
    title: item.title,
    body: item.description,
    facts: [],
    price: item.highlight ?? null,
    priceNote: null,
    imageUrl: media.imageUrl,
    videoUrl: media.videoUrl,
    visual: "offer",
    tone: kind === "ANNOUNCEMENT" ? "info" : "brand",
    cta: item.ctaUrl && item.ctaLabel ? { label: item.ctaLabel, href: item.ctaUrl, external: /^https?:\/\//.test(item.ctaUrl) } : null,
  };
}

function packageEntry(pkg: CatalogPackage, lang: Lang, context?: { renew?: number }): EntryItem {
  const t = translator(lang);
  const perMonth = monthly(pkg);

  return {
    key: `package:${pkg.slug}`,
    source: "package",
    eyebrow: pkg.isPopular ? t("الأكثر طلبًا", "Most popular") : t(`باقة ${pkg.serviceType}`, `${pkg.serviceType} plan`),
    title: pkg.name,
    body: pkg.description || null,
    facts: [pkg.durationLabel, ...pkg.features.slice(0, 3)],
    price: formatPrice(pkg.price, lang),
    priceNote: perMonth ? t(`≈ ${formatPrice(perMonth, lang)} شهريًا`, `≈ ${formatPrice(perMonth, lang)} / month`) : null,
    imageUrl: pkg.imageUrl,
    videoUrl: null,
    visual: pkg.serviceType === "VIP" ? "vip" : "iptv",
    tone: pkg.serviceType === "VIP" ? "vip" : "brand",
    cta: {
      label: t("اشترك الآن", "Subscribe now"),
      href: `/checkout?plan=${encodeURIComponent(pkg.slug)}${context?.renew ? `&renew=${context.renew}` : ""}`,
    },
  };
}

function deviceEntry(device: CatalogDevice, lang: Lang): EntryItem {
  const t = translator(lang);

  return {
    key: `device:${device.id}`,
    source: "device",
    eyebrow: t("جهاز VIP", "VIP device"),
    title: device.name,
    body: device.description || null,
    facts: device.features.slice(0, 4),
    price: formatPrice(device.price, lang),
    priceNote: t("سعر الجهاز", "Device price"),
    imageUrl: device.imageUrl,
    videoUrl: null,
    visual: "device",
    tone: "vip",
    cta: { label: t("اطلب الجهاز", "Order the device"), href: `/checkout?device=${device.id}` },
  };
}

/**
 * The payload for this viewer's entry experience. Guests, customers without a
 * plan and expired customers get promotions (admin ENTRY_GUEST items, then
 * live packages and devices). Active / expiring members get the Member
 * Spotlight: service status, renewal, unpaid order, onboarding, admin
 * ENTRY_MEMBER items, an upgrade, a relevant device, then news.
 */
export async function buildEntryPayload(user: SessionUser | null, lang: Lang): Promise<EntryPayload> {
  const t = translator(lang);
  const [viewer, packages, devices, announcements] = await Promise.all([
    getViewer(user),
    getActivePackages().catch(() => [] as CatalogPackage[]),
    getActiveDevices().catch(() => [] as CatalogDevice[]),
    getLiveAnnouncements("WEBSITE").catch(() => [] as Announcement[]),
  ]);

  if (!isMember(viewer)) {
    const admin = announcements
      .filter((item) => item.placement === "ENTRY_GUEST" && audienceMatches(item.audience, viewer))
      .map((item) => adminEntry(item, lang, false));
    const products = [
      ...[...packages].sort((a, b) => Number(b.isPopular) - Number(a.isPopular) || b.salesCount - a.salesCount).map((pkg) => packageEntry(pkg, lang)),
      ...devices.map((device) => deviceEntry(device, lang)),
    ];
    const items = [...admin, ...products];

    return items.length ? { mode: "guest", items } : { mode: "none" };
  }

  // ------------------------------------------------------ member spotlight
  const [overview, incidents] = await Promise.all([
    getCustomerOverview(user!.id),
    getActiveIncidents().catch(() => []),
  ]);
  const subscription = overview.primary;
  const items: EntryItem[] = [];

  // 1. Service alert / outage / maintenance.
  const incident = incidents[0];
  if (incident) {
    items.push({
      key: `incident:${incident.id}`,
      source: "incident",
      urgent: true,
      eyebrow: incident.upcoming || incident.status === "MAINTENANCE" ? t("صيانة مجدولة", "Scheduled maintenance") : t("حالة الخدمة", "Service status"),
      title: incident.title,
      body: incident.message,
      facts: [],
      price: null,
      priceNote: null,
      imageUrl: null,
      videoUrl: null,
      visual: "status",
      tone: incident.status === "OUTAGE" ? "danger" : "warning",
      cta: { label: t("التفاصيل", "Details"), href: "/status" },
    });
  }

  // 2. Expiry / renewal (the owner's own subscription only).
  if (subscription && (viewer.state === "EXPIRING" || subscription.daysRemaining <= 7)) {
    const days = subscription.daysRemaining;
    items.push({
      key: `renewal:${subscription.id}`,
      source: "renewal",
      urgent: true,
      eyebrow: t("تذكير التجديد", "Renewal reminder"),
      title:
        days > 0
          ? t(`اشتراكك ينتهي خلال ${days} ${days === 1 ? "يوم" : days <= 10 ? "أيام" : "يوم"}`, `Your plan ends in ${days} day${days === 1 ? "" : "s"}`)
          : t("اشتراكك ينتهي اليوم", "Your plan ends today"),
      body: t("جدّد هسه حتى تبقى المشاهدة بدون انقطاع.", "Renew now to keep watching without interruption."),
      facts: [subscription.packageName, t(`ينتهي في ${formatDate(subscription.expiryDate, lang)}`, `Ends ${formatDate(subscription.expiryDate, lang)}`)],
      price: null,
      priceNote: null,
      imageUrl: null,
      videoUrl: null,
      visual: "renewal",
      tone: "warning",
      cta: { label: t("جدّد الآن", "Renew now"), href: `/checkout?renew=${subscription.id}` },
    });
  }

  // 3. Important account update: an order still waiting for payment.
  const open = overview.openOrders[0];
  if (open) {
    const proofs = await proofUploadTimes([open.id]).catch(() => new Map<number, string>());
    if (orderStage(open.status, proofs.has(open.id)) === "PAYMENT_PENDING") {
      items.push({
        key: `order:${open.id}`,
        source: "order",
        urgent: true,
        eyebrow: t("طلب بانتظار الدفع", "Order awaiting payment"),
        title: t(`طلبك ${open.number} ينتظر إثبات الدفع`, `Order ${open.number} is waiting for payment`),
        body: t("حوّل المبلغ وارفع صورة الإثبات من حسابك حتى نراجعه.", "Transfer the amount and upload the proof from your account so we can review it."),
        facts: [open.serviceName, formatPrice(open.price + (open.devicePrice ?? 0), lang)].filter(Boolean) as string[],
        price: null,
        priceNote: null,
        imageUrl: null,
        videoUrl: null,
        visual: "order",
        tone: "info",
        cta: { label: t("أكمل الدفع", "Complete payment"), href: `/dashboard?order=${open.id}` },
      });
    }
  }

  // New subscriber: help them start watching (started within the last week).
  const started = subscription ? toDate(subscription.startDate)?.getTime() ?? 0 : 0;
  if (subscription && Date.now() - started < 7 * 24 * 60 * 60 * 1000) {
    items.push({
      key: `onboarding:${subscription.id}`,
      source: "onboarding",
      eyebrow: t("ابدأ المشاهدة", "Start watching"),
      title: t("شغّل اشتراكك على Shashtna Player", "Set up your plan on Shashtna Player"),
      body: t("حمّل التطبيق وانسخ بيانات اشتراكك من حسابك بخطوات بسيطة.", "Install the app and copy your subscription details from your account in a few steps."),
      facts: ["Android TV", "Android"],
      price: null,
      priceNote: null,
      imageUrl: null,
      videoUrl: null,
      visual: "player",
      tone: "success",
      cta: { label: t("خطوات الإعداد", "Setup steps"), href: "/watch/player" },
    });
  }

  // 4–5. Admin items for members (news first, then member offers).
  const memberAdmin = announcements.filter((item) => item.placement === "ENTRY_MEMBER" && audienceMatches(item.audience, viewer));
  const kindRank = (kind: string) => (kind === "ANNOUNCEMENT" ? 0 : kind === "NEWS" ? 1 : 2);
  memberAdmin
    .sort((a, b) => kindRank(String(a.kind)) - kindRank(String(b.kind)) || b.priority - a.priority)
    .forEach((item) => items.push(adminEntry(item, lang, true)));

  // 6. Upgrade: a longer plan of the same service than the current one.
  const current = subscription ? packages.find((pkg) => pkg.id === subscription.packageId || pkg.slug === subscription.packageSlug) : undefined;
  const upgrade = current
    ? packages.filter((pkg) => pkg.serviceType === current.serviceType && pkg.durationMonths > current.durationMonths).sort((a, b) => a.durationMonths - b.durationMonths)[0]
    : undefined;
  if (subscription && upgrade) {
    const entry = packageEntry(upgrade, lang);
    items.push({
      ...entry,
      key: `upgrade:${upgrade.slug}`,
      source: "upgrade",
      eyebrow: t("ترقية متاحة", "Upgrade available"),
      title: t(`رقِّ إلى ${upgrade.name}`, `Upgrade to ${upgrade.name}`),
      cta: { label: t("شوف الترقية", "See the upgrade"), href: `/checkout?plan=${encodeURIComponent(upgrade.slug)}&upgrade=${subscription.id}` },
    });
  }

  // 7. Relevant device: VIP members, a compatible device (never framed as new).
  if (viewer.vip && current) {
    const device = devices.find((item) => item.packageIds.includes(current.id));
    if (device) {
      items.push({ ...deviceEntry(device, lang), eyebrow: t("لجهاز إضافي", "For another screen"), cta: { label: t("شوف الجهاز", "See the device"), href: "/devices" } });
    }
  }

  // 8. General Shashtna news.
  announcements
    .filter((item) => (item.kind === "NEWS" || item.kind === "ANNOUNCEMENT") && item.placement !== "ENTRY_GUEST" && item.placement !== "ENTRY_MEMBER" && audienceMatches(item.audience, viewer))
    .slice(0, 2)
    .forEach((item) => items.push({ ...adminEntry(item, lang, true), key: `news:${item.id}`, source: "news" }));

  return items.length ? { mode: "member", items } : { mode: "none" };
}
