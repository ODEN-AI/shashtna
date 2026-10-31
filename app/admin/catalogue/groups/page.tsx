import type { Metadata } from "next";
import { Layers } from "lucide-react";

import { CatalogueHeader } from "@/app/components/admin/catalogue/CatalogueUI";
import { GroupForm } from "@/app/components/admin/catalogue/GroupForm";
import { SectionCard } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { requireStaffPage } from "@/src/server/auth";
import { listGroups } from "@/src/server/groups";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المجموعات — الكتالوج" };

/**
 * Plan groups: the sections of /plans. IPTV and VIP are built in; the owner
 * adds digital platforms (Netflix, beIN Sports…) with their colours, logo and
 * delivery, then assigns packages to them from the package form.
 */
export default async function GroupsPage() {
  const { allowed } = await requireStaffPage("/admin/catalogue/groups", "catalogue");

  if (!allowed) return <Forbidden />;

  const [{ t }, groups] = await Promise.all([getI18n(), listGroups()]);

  return (
    <div className="space-y-5" data-testid="catalogue-groups">
      <CatalogueHeader
        active="groups"
        t={t}
        title={t("المجموعات", "Groups")}
        description={t(
          "كل مجموعة قسم بصفحة الباقات. IPTV وVIP أساسية؛ المنصات (Netflix، beIN…) تضيفها هنا ثم تربط باقاتها من صفحة الباقة. المجموعة المخفية أو الفارغة ما تظهر.",
          "Each group is a section of the plans page. IPTV and VIP are built in; add platforms (Netflix, beIN…) here, then assign their packages from the package page. A hidden or empty group isn't shown.",
        )}
      />

      <ul className="space-y-4">
        {groups.map((group) => (
          <li key={group.id}>
            <details className="surface rounded-card p-5" data-testid="group-row" data-group={group.slug}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span aria-hidden className="inline-block h-4 w-4 rounded-full" style={{ background: group.accent }} />
                <b className="text-ink">{group.name}</b>
                <span className="nums text-xs text-ink-3" dir="ltr">
                  /{group.slug} · #{group.sortOrder}
                </span>
                {group.builtIn ? <Badge tone="neutral">{t("أساسية", "Built-in")}</Badge> : <Badge tone="info">{group.delivery}</Badge>}
                {group.isActive ? null : <Badge tone="warning">{t("مخفية", "Hidden")}</Badge>}
                <span className="nums ms-auto text-xs text-ink-3">{t(`${group.packages.active} باقة فعّالة من ${group.packages.total}`, `${group.packages.active} of ${group.packages.total} packages active`)}</span>
              </summary>
              <div className="mt-5 border-t border-line pt-5">
                <GroupForm
                  initial={{
                    id: group.id,
                    name: group.name,
                    nameEn: group.nameEn ?? null,
                    slug: group.slug,
                    logoUrl: group.logoUrl ?? null,
                    description: group.description ?? null,
                    descriptionEn: group.descriptionEn ?? null,
                    sortOrder: group.sortOrder,
                    isActive: group.isActive,
                    accent: group.accent,
                    surface: group.surface,
                    delivery: group.delivery,
                    builtIn: group.builtIn,
                  }}
                />
              </div>
            </details>
          </li>
        ))}
      </ul>

      <SectionCard title={t("إضافة منصة", "Add a platform")} icon={<Layers size={14} aria-hidden />} testId="group-new">
        <GroupForm initial={{ name: "", nameEn: null, slug: "", logoUrl: null, description: null, descriptionEn: null, sortOrder: 10, isActive: true, accent: "#5cc8ff", surface: "#06132e", delivery: "ACCOUNT" }} />
      </SectionCard>
    </div>
  );
}
