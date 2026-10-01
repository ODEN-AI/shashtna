import type { Metadata } from "next";
import Link from "next/link";
import { Cpu, Package, Search } from "lucide-react";

import { CompatibilityToggles } from "@/app/components/admin/catalogue/CatalogueClient";
import { ActiveBadge, CatalogueHeader, CompatChip } from "@/app/components/admin/catalogue/CatalogueUI";
import { EmptyLine, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { requireStaffPage } from "@/src/server/auth";
import { getCompatibility } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التوافق — الكتالوج" };

/**
 * Which devices work with which packages — the existing PackageDevice links,
 * shown both ways. Links only exist for VIP (a VIP package is sold with a
 * linked VIP device); toggles save through the existing package API.
 */
export default async function CompatibilityPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: rawQ } = await searchParams;
  const { allowed } = await requireStaffPage("/admin/catalogue/compatibility", "catalogue");

  if (!allowed) return <Forbidden />;

  const { t } = await getI18n();
  const q = String(rawQ ?? "").trim().slice(0, 80);
  const data = await getCompatibility(q);

  return (
    <div className="space-y-5" data-testid="catalogue-compatibility">
      <CatalogueHeader active="compatibility" t={t} title={t("التوافق بين الباقات والأجهزة", "Package ↔ device compatibility")} description={t("باقات VIP تُباع مع جهاز VIP مرتبط بها. باقات IPTV لا تحتاج جهازًا.", "VIP packages are sold with a linked VIP device. IPTV packages don't need one.")} />

      <form role="search" className="glass-soft flex flex-wrap gap-2 rounded-2xl p-2" data-testid="compat-search-form">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("بحث", "Search")}</span>
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={q} data-testid="compat-search" placeholder={t("ابحث باسم باقة أو جهاز", "Search by package or device")} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none" />
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("بحث", "Search")}</button>
      </form>

      {!data.ok ? (
        <SectionError label={t("تعذر تحميل التوافق.", "Couldn't load compatibility.")} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <SectionCard title={t("لكل باقة: الأجهزة المتوافقة", "Per package: compatible devices")} icon={<Package size={14} aria-hidden />} testId="compat-by-package">
            {data.packages.length ? (
              <ul className="space-y-3">
                {data.packages.map((pkg) => (
                  <li key={pkg.id} className="rounded-2xl border border-line/70 bg-white/[0.02] p-4" data-testid="compat-package" data-package={pkg.id}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/admin/catalogue/packages/${pkg.id}`} className="font-bold text-ink hover:text-brand-ink">{pkg.name}</Link>
                      <span className="flex items-center gap-2">
                        {pkg.unsellable ? <span className="text-xs font-semibold text-warning" data-testid="compat-unsellable">{t("لا يمكن شراؤها: لا جهاز فعّال", "Can't be bought: no active device")}</span> : null}
                        <ActiveBadge active={pkg.isActive} t={t} />
                      </span>
                    </div>
                    <CompatibilityToggles packageId={pkg.id} packageName={pkg.name} deviceIds={pkg.deviceIds} devices={data.allDevices} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{data.total.packages ? t("لا توجد باقات مطابقة.", "No matching packages.") : t("لا توجد باقات VIP في الكتالوج.", "No VIP packages in the catalogue.")}</EmptyLine>
            )}
          </SectionCard>

          <SectionCard title={t("لكل جهاز: الباقات التي تدعمه", "Per device: supporting packages")} icon={<Cpu size={14} aria-hidden />} testId="compat-by-device">
            {data.devices.length ? (
              <ul className="space-y-3">
                {data.devices.map((device) => (
                  <li key={device.id} className="rounded-2xl border border-line/70 bg-white/[0.02] p-4" data-testid="compat-device" data-device={device.id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/admin/catalogue/devices/${device.id}`} className="font-bold text-ink hover:text-brand-ink">{device.name}</Link>
                      <ActiveBadge active={device.isActive} t={t} />
                    </div>
                    {device.packages.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {device.packages.map((pkg) => <CompatChip key={pkg.id} name={pkg.name} active={pkg.isActive} href={`/admin/catalogue/packages/${pkg.id}`} t={t} />)}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-3">{t("لا توجد باقات متوافقة", "No compatible packages")}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{data.total.devices ? t("لا توجد أجهزة مطابقة.", "No matching devices.") : t("لا توجد أجهزة VIP في الكتالوج.", "No VIP devices in the catalogue.")}</EmptyLine>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
