import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Globe, History, Link2, Power } from "lucide-react";

import { DeviceForm, ProductActions } from "@/app/components/admin/catalogue/CatalogueClient";
import { ActiveBadge, CatalogueHeader, CompatChip, TypeBadge } from "@/app/components/admin/catalogue/CatalogueUI";
import { EmptyLine, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { DeviceCard } from "@/app/ui/DeviceCard";
import { formatDateTime, formatPrice } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { safeHref, splitLines } from "@/src/server/catalog";
import { getDeviceDetail } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "جهاز — الكتالوج" };

/**
 * One device: edit it (existing device API), see which packages it works
 * with, what customers see, and what depends on it before retiring it.
 */
export default async function CatalogueDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, allowed } = await requireStaffPage(`/admin/catalogue/devices/${id}`, "catalogue");

  if (!allowed) return <Forbidden />;

  const deviceId = Number(id);
  const data = Number.isInteger(deviceId) && deviceId > 0 ? await getDeviceDetail(user.role, deviceId) : null;

  if (!data) notFound();

  const { t, lang } = await getI18n();
  const { device, compatibility, usage, activity } = data;
  const packageIds = compatibility.ok ? compatibility.linked.map((pkg) => pkg.id) : [];
  // The device API saves a device as a whole (PUT), links included.
  const current = {
    name: device.name,
    slug: device.slug,
    serviceType: device.serviceType,
    price: device.price,
    description: device.description,
    specifications: device.specifications,
    notes: device.notes,
    imageUrl: device.imageUrl,
    isActive: device.isActive,
    packageIds,
  };

  return (
    <div className="space-y-5" data-testid="catalogue-device" data-device={device.id}>
      <CatalogueHeader
        active="devices"
        t={t}
        title={<span className="flex flex-wrap items-center gap-2">{device.name} <TypeBadge type={device.serviceType} /> <ActiveBadge active={device.isActive} t={t} /></span>}
        description={<span className="nums" dir="ltr">#{device.id} · {device.slug} · {formatPrice(device.price, lang)}</span>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {compatibility.ok ? (
            <DeviceForm initial={{ id: device.id, ...current }} packages={compatibility.candidates.map((pkg) => ({ ...pkg, serviceType: device.serviceType }))} />
          ) : (
            // Saving rewrites the links: without the current ones the form would erase them.
            <SectionError label={t("تعذر تحميل الباقات المتوافقة — التعديل غير متاح الآن. حدّث الصفحة.", "Couldn't load compatible packages — editing is unavailable. Refresh the page.")} />
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <SectionCard title={t("الحالة", "Status")} icon={<Power size={14} aria-hidden />} testId="catalogue-status-card">
            {compatibility.ok ? (
              <ProductActions
                kind="device"
                id={device.id}
                name={device.name}
                isActive={device.isActive}
                devicePayload={current}
                deletable={usage.ok && usage.orders === 0}
                deleteBlockedReason={usage.ok ? t("مرتبط بطلبات سابقة: أوقفه بدل الحذف للحفاظ على السجل.", "Referenced by past orders: deactivate it instead to keep their history.") : t("تعذر التحقق من الارتباطات، الحذف غير متاح.", "Couldn't check references; delete is unavailable.")}
              />
            ) : (
              <SectionError label={t("غير متاح الآن.", "Unavailable right now.")} />
            )}
          </SectionCard>

          <SectionCard title={t("أين يُستخدم", "Where it's used")} icon={<Globe size={14} aria-hidden />} testId="catalogue-usage">
            {usage.ok ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-3">{t("الطلبات", "Orders")}</dt><dd className="nums font-bold" data-testid="usage-orders">{usage.orders}</dd></div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">{t("الموقع", "Website")}</dt>
                  <dd className="text-end" data-testid="usage-website">
                    {device.isActive ? (
                      <span className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs font-semibold">
                        <a href="/devices" target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">/devices</a>
                        <a href={`/checkout?device=${device.id}`} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline" dir="ltr">/checkout?device={device.id}</a>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">{t("مخفي (موقوف)", "Hidden (inactive)")}</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">{t("العروض", "Offers")}</dt>
                  <dd className="text-end text-xs" data-testid="usage-offers">
                    {usage.offers.length ? usage.offers.map((offer) => (
                      <span key={offer.id} className="block">{data.can("content") ? <Link href="/admin/announcements" className="text-brand-ink hover:underline">{offer.title}</Link> : offer.title}{offer.isActive ? "" : ` (${t("موقوف", "inactive")})`}</span>
                    )) : <span className="text-ink-3">—</span>}
                  </dd>
                </div>
              </dl>
            ) : (
              <SectionError label={t("تعذر تحميل بيانات الاستخدام.", "Couldn't load usage.")} />
            )}
            <p className="mt-3 text-xs leading-5 text-ink-3">{t("الطلبات تحتفظ باسم الجهاز وسعره وقت الشراء؛ تعديل الجهاز لا يغيّرها.", "Orders keep the device name and price from the time of purchase; editing the device doesn't change them.")}</p>
          </SectionCard>

          <SectionCard title={t("الباقات المتوافقة", "Compatible packages")} icon={<Link2 size={14} aria-hidden />} action={device.serviceType === "VIP" ? { href: "/admin/catalogue/compatibility", label: t("التوافق", "Compatibility") } : undefined} testId="catalogue-compat">
            {!compatibility.ok ? (
              <SectionError label={t("تعذر تحميل الباقات", "Couldn't load packages")} />
            ) : compatibility.linked.length ? (
              <div className="flex flex-wrap gap-1.5">{compatibility.linked.map((pkg) => <CompatChip key={pkg.id} name={pkg.name} active={pkg.isActive} href={`/admin/catalogue/packages/${pkg.id}`} t={t} />)}</div>
            ) : (
              <EmptyLine>{t("لا توجد باقات متوافقة", "No compatible packages")}</EmptyLine>
            )}
          </SectionCard>

          <SectionCard title={t("كما يراه العميل", "What customers see")} icon={<Eye size={14} aria-hidden />} testId="catalogue-preview">
            <div inert className="pointer-events-none select-none">
              <DeviceCard
                lang={lang}
                plans={[]}
                device={{ id: device.id, name: device.name, slug: device.slug, serviceType: device.serviceType, price: device.price, description: device.description, features: splitLines(device.specifications), notes: device.notes, imageUrl: safeHref(device.imageUrl), packageIds }}
              />
            </div>
            {device.isActive ? null : <p className="mt-3 text-xs text-ink-3">{t("موقوف: لا يظهر في الموقع حاليًا.", "Inactive: not shown on the website right now.")}</p>}
          </SectionCard>

          <SectionCard title={t("سجل التعديلات", "Change history")} icon={<History size={14} aria-hidden />} testId="catalogue-history">
            {!activity.ok ? (
              <SectionError label={t("تعذر تحميل السجل.", "Couldn't load history.")} />
            ) : activity.data.length ? (
              <ol className="space-y-3">
                {activity.data.map((event) => (
                  <li key={event.id} className="text-sm" data-testid="catalogue-history-item" data-action={event.action}>
                    <p className="leading-6 text-ink">{event.summary}</p>
                    {event.details ? <p className="whitespace-pre-line break-words text-xs leading-5 text-ink-3" dir="ltr">{event.details}</p> : null}
                    <p className="nums text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyLine>{t("لا توجد تعديلات مسجلة بعد.", "No recorded changes yet.")}</EmptyLine>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
