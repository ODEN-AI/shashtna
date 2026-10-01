import type { Metadata } from "next";

import { saveAnnouncementAction } from "@/app/admin/actions";
import { ContentEditor } from "@/app/components/admin/promotions/PromotionsClient";
import { PromotionsHeader, contentLabels } from "@/app/components/admin/promotions/PromotionsUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { EDITORIAL_KINDS } from "@/src/lib/promotions";
import { hasPermission } from "@/src/lib/roles";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "محتوى جديد — العروض والمحتوى" };

export default async function NewContentPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: requested } = await searchParams;
  const { user, allowed } = await requireStaffPage("/admin/promotions/items/new", "content");

  if (!allowed) return <Forbidden />;

  const { t } = await getI18n();
  const kind = EDITORIAL_KINDS.find((value) => value === String(requested ?? "").toUpperCase()) ?? "OFFER";
  const news = kind === "NEWS" || kind === "ANNOUNCEMENT";

  return (
    <div className="space-y-5" data-testid="promo-new">
      <PromotionsHeader
        active={news ? "announcements" : "offers"}
        t={t}
        can={(permission) => hasPermission(user.role, permission)}
        title={news ? t("خبر أو تنبيه جديد", "New news item or announcement") : t("إعلان أو عرض جديد", "New ad or offer")}
        description={t("يُحفظ عبر نفس إجراء الحفظ المستخدم في صفحة الإعلانات، مع التحقق على الخادم وسجل التدقيق.", "Saved through the same save action as the announcements page, validated on the server and audited.")}
      />
      <div className="max-w-4xl">
        <ContentEditor
          action={saveAnnouncementAction}
          labels={contentLabels(t)}
          initial={{
            kind,
            title: "",
            description: null,
            highlight: null,
            imageUrl: null,
            videoUrl: null,
            mediaType: "IMAGE",
            ctaLabel: null,
            ctaUrl: null,
            target: "WEBSITE",
            placement: news ? "HOME_LATEST" : "HERO_EDITORIAL",
            audience: "ALL",
            style: "STANDARD",
            priority: 0,
            // New content starts unpublished: staff publish it once it's ready.
            isActive: false,
            startsAt: "",
            endsAt: "",
          }}
        />
      </div>
    </div>
  );
}
