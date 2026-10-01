import type { Metadata } from "next";

import { DeviceForm } from "@/app/components/admin/catalogue/CatalogueClient";
import { CatalogueHeader } from "@/app/components/admin/catalogue/CatalogueUI";
import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { requireStaffPage } from "@/src/server/auth";
import { getLinkOptions } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "جهاز جديد — الكتالوج" };

export default async function NewDevicePage() {
  const { allowed } = await requireStaffPage("/admin/catalogue/devices/new", "catalogue");

  if (!allowed) return <Forbidden />;

  const { t } = await getI18n();
  const options = await getLinkOptions();

  return (
    <div className="space-y-5" data-testid="catalogue-device-new">
      <CatalogueHeader active="devices" t={t} title={t("جهاز جديد", "New device")} description={t("تُحفظ عبر واجهة الأجهزة الحالية، مع التحقق على الخادم.", "Saved through the existing devices API, validated on the server.")} />
      <div className="max-w-4xl">
        {options?.ok ? (
          <DeviceForm
            initial={{ name: "", slug: "", serviceType: "VIP", price: "", description: "", specifications: "", notes: null, imageUrl: null, isActive: true, packageIds: [] }}
            packages={options.data.packages}
          />
        ) : (
          <SectionError label={t("تعذر تحميل الباقات", "Couldn't load packages")} />
        )}
      </div>
    </div>
  );
}
