import type { Metadata } from "next";
import Link from "next/link";
import { Film, ImageOff } from "lucide-react";

import { LifecycleBadge, PromotionsHeader } from "@/app/components/admin/promotions/PromotionsUI";
import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { EmptyState } from "@/app/ui/States";
import { hasPermission } from "@/src/lib/roles";
import { safeHref } from "@/src/lib/safe-href";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { listContentMedia } from "@/src/server/promotions-console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الوسائط — العروض والمحتوى" };

/**
 * Promotional media in use: every image and video the ads, offers and news
 * reference. Files are uploaded from the content editor through the
 * existing media upload route (images and short MP4/WEBM videos).
 */
export default async function PromotionsMediaPage() {
  const { user, allowed } = await requireStaffPage("/admin/promotions/media", "content");

  if (!allowed) return <Forbidden />;

  const { t } = await getI18n();
  const result = await listContentMedia();

  return (
    <div className="space-y-5" data-testid="promo-media-page">
      <PromotionsHeader
        active="media"
        t={t}
        can={(permission) => hasPermission(user.role, permission)}
        title={t("الوسائط المستخدمة", "Media in use")}
        description={result.ok ? <span data-testid="promo-media-count">{t(`${result.items.length} ملف مستخدم`, `${result.items.length} files in use`)}</span> : undefined}
      />
      <p className="text-sm text-ink-3">{t("الرفع يتم من محرر المحتوى (صور JPG/PNG/WEBP/GIF أو فيديو MP4/WEBM قصير). هنا ترى أين يُستخدم كل ملف.", "Uploads happen in the content editor (JPG/PNG/WEBP/GIF images or a short MP4/WEBM video). Here you see where each file is used.")}</p>

      {!result.ok ? (
        <SectionError label={t("تعذر تحميل الوسائط.", "Couldn't load media.")} />
      ) : result.items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((item) => {
            const url = safeHref(item.url);

            return (
              <li key={item.url} className="overflow-hidden rounded-2xl border border-line bg-surface/70" data-testid="promo-media-item" data-type={item.type}>
                <div className="relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-navy to-canvas text-ink-3">
                  {!url ? (
                    <ImageOff size={20} aria-hidden />
                  ) : item.type === "VIDEO" ? (
                    <video src={url} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  {item.type === "VIDEO" ? <Film size={16} className="absolute end-3 top-3 text-white drop-shadow" aria-label={t("فيديو", "Video")} /> : null}
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-xs text-ink-3" dir="ltr" title={item.url}>{item.url}</p>
                  <ul className="space-y-1">
                    {item.usedBy.map((use) => (
                      <li key={`${use.id}-${use.role}`} className="flex items-center justify-between gap-2 text-sm">
                        <Link href={`/admin/promotions/items/${use.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-brand-ink">{use.title}</Link>
                        <LifecycleBadge lifecycle={use.lifecycle} t={t} />
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={t("لا توجد وسائط مستخدمة", "No media in use")} description={t("أضف صورة أو فيديو لإعلان من محرر المحتوى.", "Add an image or video to an item from the content editor.")} />
      )}
    </div>
  );
}
