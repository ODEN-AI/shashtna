import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock3, Cpu, Package, Plus } from "lucide-react";

import { ActiveBadge, CatalogueHeader } from "@/app/components/admin/catalogue/CatalogueUI";
import { EmptyLine, KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { LinkButton } from "@/app/ui/Button";
import { formatDateTime } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { getCatalogueOverview } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الكتالوج" };

/**
 * Catalogue command centre: what we sell, what's live, and what needs
 * attention (VIP packages nobody can buy for lack of a compatible device,
 * devices linked to nothing). Every number links to the filtered list.
 */
export default async function CataloguePage() {
  const { user, allowed } = await requireStaffPage("/admin/catalogue", "catalogue");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const data = await getCatalogueOverview(user.role);
  const actions = (
    <>
      <LinkButton href="/admin/catalogue/packages/new" size="sm"><Plus size={15} aria-hidden /> {t("باقة جديدة", "New package")}</LinkButton>
      <LinkButton href="/admin/catalogue/devices/new" size="sm" variant="secondary"><Plus size={15} aria-hidden /> {t("جهاز جديد", "New device")}</LinkButton>
    </>
  );

  return (
    <div className="space-y-6" data-testid="catalogue-overview">
      <CatalogueHeader active="overview" t={t} title={t("الكتالوج", "Catalogue")} description={t("ماذا نبيع، بكم، وما المتاح، وما الذي يعمل مع ماذا.", "What we sell, what it costs, what's available and what works with what.")} actions={actions} />

      {!data.ok ? (
        <SectionError label={t("تعذر تحميل الكتالوج. حدّث الصفحة.", "Couldn't load the catalogue. Refresh the page.")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="catalogue-kpis">
            <KpiTile hero label={t("باقات فعّالة", "Active packages")} value={data.packages.active} hint={t(`${data.packages.inactive} موقوفة`, `${data.packages.inactive} inactive`)} href="/admin/catalogue/packages?view=active" testId="catalogue-kpi-active-packages" />
            <KpiTile label={t("باقات موقوفة", "Inactive packages")} value={data.packages.inactive} href="/admin/catalogue/packages?view=inactive" testId="catalogue-kpi-inactive-packages" />
            <KpiTile label={t("الأجهزة", "Devices")} value={data.devices.total} hint={t(`${data.devices.active} فعّال`, `${data.devices.active} active`)} href="/admin/catalogue/devices" testId="catalogue-kpi-devices" />
            <KpiTile label={t("أجهزة فعّالة", "Active devices")} value={data.devices.active} href="/admin/catalogue/devices?view=active" testId="catalogue-kpi-active-devices" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t("باقات VIP بلا جهاز متوافق", "VIP packages with no compatible device")} icon={<AlertTriangle size={14} aria-hidden />} action={{ href: "/admin/catalogue/packages?view=no-devices", label: t("عرض", "View") }} testId="catalogue-no-devices">
              <p className="mb-3 text-xs leading-5 text-ink-3">{t("لا يمكن للعملاء شراء باقة VIP بدون جهاز VIP فعّال مرتبط بها.", "Customers can't buy a VIP package without an active VIP device linked to it.")}</p>
              {data.packages.noDevices.length ? (
                <ul className="space-y-2">
                  {data.packages.noDevices.map((pkg) => (
                    <li key={pkg.id}>
                      <Link href={`/admin/catalogue/packages/${pkg.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm font-semibold text-ink hover:border-warning/60" data-testid="catalogue-attention-item">
                        <span className="flex min-w-0 items-center gap-2"><Package size={14} aria-hidden className="shrink-0 text-warning" /> <span className="truncate">{pkg.name}</span></span>
                        <span className="shrink-0 text-xs text-warning">{t("أضف جهازًا", "Link a device")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("كل باقات VIP الفعّالة لها جهاز متوافق.", "Every active VIP package has a compatible device.")}</EmptyLine>
              )}
            </SectionCard>

            <SectionCard title={t("أجهزة غير مرتبطة بأي باقة", "Devices not linked to any package")} icon={<Cpu size={14} aria-hidden />} action={{ href: "/admin/catalogue/devices?view=unlinked", label: t("عرض", "View") }} testId="catalogue-unlinked">
              <p className="mb-3 text-xs leading-5 text-ink-3">{t("تُباع كجهاز منفصل فقط، ولا تظهر كخيار مع أي باقة.", "Sold only on their own; never offered with a package.")}</p>
              {data.devices.unlinked.length ? (
                <ul className="space-y-2">
                  {data.devices.unlinked.map((device) => (
                    <li key={device.id}>
                      <Link href={`/admin/catalogue/devices/${device.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-sm font-semibold text-ink hover:border-brand/40" data-testid="catalogue-unlinked-item">
                        <span className="truncate">{device.name}</span>
                        <ActiveBadge active={device.isActive} t={t} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>{t("كل الأجهزة مرتبطة بباقة واحدة على الأقل.", "Every device is linked to at least one package.")}</EmptyLine>
              )}
            </SectionCard>
          </div>

          <SectionCard title={t("آخر التعديلات", "Recently updated")} icon={<Clock3 size={14} aria-hidden />} testId="catalogue-recent">
            {data.recent.length ? (
              <ul className="divide-y divide-line/60">
                {data.recent.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={`/admin/catalogue/${item.kind === "package" ? "packages" : "devices"}/${item.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-brand-ink" data-testid="catalogue-recent-item">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                        {item.kind === "package" ? <Package size={14} aria-hidden className="shrink-0 text-ink-3" /> : <Cpu size={14} aria-hidden className="shrink-0 text-ink-3" />}
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <ActiveBadge active={item.isActive} t={t} />
                        <span className="nums text-xs text-ink-3">{formatDateTime(item.updatedAt, lang)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{t("لا توجد منتجات في الكتالوج بعد.", "No products in the catalogue yet.")}</EmptyLine>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
