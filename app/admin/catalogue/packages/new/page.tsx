import type { Metadata } from "next";

import { PackageForm } from "@/app/components/admin/catalogue/CatalogueClient";
import { CatalogueHeader } from "@/app/components/admin/catalogue/CatalogueUI";
import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { requireStaffPage } from "@/src/server/auth";
import { getLinkOptions } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "باقة جديدة — الكتالوج" };

export default async function NewPackagePage() {
  const { allowed } = await requireStaffPage("/admin/catalogue/packages/new", "catalogue");

  if (!allowed) return <Forbidden />;

  const { t } = await getI18n();
  const options = await getLinkOptions();

  return (
    <div className="space-y-5" data-testid="catalogue-package-new">
      <CatalogueHeader active="packages" t={t} title={t("باقة جديدة", "New package")} description={t("تُحفظ عبر واجهة الباقات الحالية، مع التحقق على الخادم.", "Saved through the existing packages API, validated on the server.")} />
      <div className="max-w-4xl">
        {options?.ok ? (
          <PackageForm
            initial={{ name: "", slug: "", serviceType: "IPTV", price: "", durationMonths: 12, durationLabel: "1 Year", description: "", specifications: "", notes: null, imageUrl: null, isActive: true, deviceIds: [] }}
            devices={options.data.devices}
          />
        ) : (
          <SectionError label={t("تعذر تحميل الأجهزة", "Couldn't load devices")} />
        )}
      </div>
    </div>
  );
}
