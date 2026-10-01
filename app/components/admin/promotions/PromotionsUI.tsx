import { Bell, Globe, ImageIcon, Layers, LayoutGrid, Megaphone, Newspaper, Tv } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/app/ui/Badge";
import { LinkTabs } from "@/app/ui/Tabs";
import type { Lifecycle } from "@/src/lib/content-console";
import type { Translate } from "@/src/lib/i18n";
import type { Permission } from "@/src/lib/roles";

/** Promotions & content building blocks, on the console's existing primitives. */

export type PromotionsSection = "overview" | "content" | "offers" | "announcements" | "media" | "notifications";

export function PromotionsHeader({ active, t, can, title, description, actions }: { active: PromotionsSection; t: Translate; can: (permission: Permission) => boolean; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  const tabs = [
    { key: "overview", href: "/admin/promotions", label: <><LayoutGrid size={14} aria-hidden /> {t("نظرة عامة", "Overview")}</>, show: true },
    { key: "content", href: "/admin/promotions/content", label: <><Layers size={14} aria-hidden /> {t("كل المحتوى", "All content")}</>, show: can("content") },
    { key: "offers", href: "/admin/promotions/offers", label: <><Megaphone size={14} aria-hidden /> {t("الإعلانات والعروض", "Ads & offers")}</>, show: can("content") },
    { key: "announcements", href: "/admin/promotions/announcements", label: <><Newspaper size={14} aria-hidden /> {t("الأخبار والتنبيهات", "News & announcements")}</>, show: can("content") },
    { key: "media", href: "/admin/promotions/media", label: <><ImageIcon size={14} aria-hidden /> {t("الوسائط", "Media")}</>, show: can("content") },
    { key: "notifications", href: "/admin/promotions/notifications", label: <><Bell size={14} aria-hidden /> {t("الإشعارات", "Notifications")}</>, show: can("support") },
  ].filter((tab) => tab.show);

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
            <Megaphone size={14} aria-hidden /> {t("العروض والمحتوى", "Promotions & content")}
          </p>
          <h1 className="mt-2 text-h2 font-bold text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <LinkTabs label={t("أقسام العروض والمحتوى", "Promotions sections")} active={active} tabs={tabs} />
    </header>
  );
}

export function lifecycleLabels(t: Translate): Record<Lifecycle, { tone: "success" | "info" | "neutral" | "warning"; label: string }> {
  return {
    LIVE: { tone: "success", label: t("يُعرض الآن", "Live") },
    SCHEDULED: { tone: "info", label: t("مجدول", "Scheduled") },
    ENDED: { tone: "warning", label: t("انتهت مدته", "Ended") },
    INACTIVE: { tone: "neutral", label: t("متوقف", "Inactive") },
  };
}

export function LifecycleBadge({ lifecycle, t }: { lifecycle: Lifecycle; t: Translate }) {
  const entry = lifecycleLabels(t)[lifecycle];

  return (
    <span data-testid="promo-lifecycle" data-lifecycle={lifecycle}>
      <Badge tone={entry.tone} dot className="whitespace-nowrap">{entry.label}</Badge>
    </span>
  );
}

/** The vocabulary of the existing editor (same values saveAnnouncementAction accepts). */
export function contentLabels(t: Translate) {
  return {
    kind: { AD: t("إعلان", "Ad"), OFFER: t("عرض", "Offer"), NEWS: t("خبر", "News"), ANNOUNCEMENT: t("تنبيه / إعلان", "Announcement") } as Record<string, string>,
    target: { ALL: t("الموقع + التطبيق", "Website + Player"), WEBSITE: t("الموقع فقط", "Website only"), PLAYER: t("Shashtna Player فقط", "Shashtna Player only") } as Record<string, string>,
    placement: {
      HERO_EDITORIAL: t("الواجهة الرئيسية — لوحة العروض والأخبار", "Homepage hero — offers & news board"),
      HOME_CAROUSEL: t("الصفحة الرئيسية (عرض متحرك)", "Homepage carousel"),
      HOME_LATEST: t("الصفحة الرئيسية — آخر الإعلانات", "Homepage — latest announcements"),
      ENTRY_GUEST: t("شاشة الدخول — الزوار والمنتهية اشتراكاتهم", "Entry screen — guests & expired"),
      ENTRY_MEMBER: t("شاشة الدخول — المشتركين", "Entry screen — members"),
      BANNER: t("شريط إعلاني (التطبيق)", "Banner (Player)"),
      DASHBOARD: t("لوحة العميل", "Customer dashboard"),
    } as Record<string, string>,
    audience: {
      ALL: t("الجميع", "Everyone"),
      GUEST: t("الزوار وغير المشتركين", "Guests & not subscribed"),
      EXPIRED: t("المنتهية اشتراكاتهم", "Expired"),
      ACTIVE: t("المشتركين النشطين", "Active members"),
      EXPIRING: t("اشتراكاتهم تنتهي قريبًا", "Expiring soon"),
      VIP: t("مشتركي VIP", "VIP members"),
    } as Record<string, string>,
    style: { STANDARD: t("عادي", "Standard"), HIGHLIGHT: t("مميز", "Highlight"), INFO: t("معلومة", "Info"), WARNING: t("تنبيه", "Warning") } as Record<string, string>,
  };
}

/** Where an item is shown (website pages, Shashtna Player). */
export function SurfaceList({ surfaces, t }: { surfaces: { website: string[]; player: boolean }; t: Translate }) {
  if (!surfaces.website.length && !surfaces.player) return <span className="text-xs text-ink-3">{t("لا يظهر في أي واجهة", "Not shown anywhere")}</span>;

  return (
    <span className="flex flex-wrap gap-1.5" data-testid="promo-surfaces">
      {surfaces.website.map((place) => (
        <span key={place} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2" dir="ltr">
          <Globe size={11} aria-hidden /> {place}
        </span>
      ))}
      {surfaces.player ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
          <Tv size={11} aria-hidden /> Shashtna Player
        </span>
      ) : null}
    </span>
  );
}
