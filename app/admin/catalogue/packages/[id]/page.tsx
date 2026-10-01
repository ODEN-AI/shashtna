import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Globe, History, Link2, Power } from "lucide-react";

import { PackageForm, ProductActions } from "@/app/components/admin/catalogue/CatalogueClient";
import { ActiveBadge, CatalogueHeader, CompatChip, TypeBadge } from "@/app/components/admin/catalogue/CatalogueUI";
import { EmptyLine, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { PackageCard } from "@/app/ui/PackageCard";
import { formatDateTime, formatPrice } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { safeHref, splitLines } from "@/src/server/catalog";
import { getPackageDetail } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "باقة — الكتالوج" };

/**
 * One package: edit it (existing package API), see what customers see,
 * which devices work with it, and what depends on it before retiring it.
 */
export default async function CataloguePackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, allowed } = await requireStaffPage(`/admin/catalogue/packages/${id}`, "catalogue");

  if (!allowed) return <Forbidden />;

  const packageId = Number(id);
  const data = Number.isInteger(packageId) && packageId > 0 ? await getPackageDetail(user.role, packageId) : null;

  if (!data) notFound();

  const { t, lang } = await getI18n();
  const { pkg, compatibility, usage, activity } = data;
  const referenced = !usage.ok || usage.orders > 0 || usage.subscriptions > 0;

  return (
    <div className="space-y-5" data-testid="catalogue-package" data-package={pkg.id}>
      <CatalogueHeader
        active="packages"
        t={t}
        title={<span className="flex flex-wrap items-center gap-2">{pkg.name} <TypeBadge type={pkg.serviceType} /> <ActiveBadge active={pkg.isActive} t={t} /></span>}
        description={<span className="nums" dir="ltr">#{pkg.id} · {pkg.slug} · {formatPrice(pkg.price, lang)}</span>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {compatibility.ok ? (
            <PackageForm
              initial={{
                id: pkg.id,
                name: pkg.name,
                slug: pkg.slug,
                serviceType: pkg.serviceType,
                price: pkg.price,
                durationMonths: pkg.durationMonths,
                durationLabel: pkg.durationLabel,
                description: pkg.description,
                specifications: pkg.specifications,
                notes: pkg.notes,
                imageUrl: pkg.imageUrl,
                isActive: pkg.isActive,
                deviceIds: compatibility.linked.map((device) => device.id),
              }}
              devices={compatibility.candidates.map((device) => ({ ...device, serviceType: pkg.serviceType }))}
              // Orders reference packages by slug: it can't change once used (the API enforces this too).
              slugLocked={!usage.ok || usage.orders > 0}
            />
          ) : (
            // Without the current links the form could overwrite them: don't offer it.
            <SectionError label={t("تعذر تحميل الأجهزة المتوافقة — التعديل غير متاح الآن. حدّث الصفحة.", "Couldn't load compatible devices — editing is unavailable. Refresh the page.")} />
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <SectionCard title={t("الحالة", "Status")} icon={<Power size={14} aria-hidden />} testId="catalogue-status-card">
            <ProductActions
              kind="package"
              id={pkg.id}
              name={pkg.name}
              isActive={pkg.isActive}
              deletable={!referenced}
              deleteBlockedReason={usage.ok ? t("مرتبطة بطلبات أو اشتراكات: أوقفها بدل الحذف للحفاظ على السجل.", "Referenced by orders or subscriptions: deactivate it instead to keep their history.") : t("تعذر التحقق من الارتباطات، الحذف غير متاح.", "Couldn't check references; delete is unavailable.")}
            />
          </SectionCard>

          <SectionCard title={t("أين تُستخدم", "Where it's used")} icon={<Globe size={14} aria-hidden />} testId="catalogue-usage">
            {usage.ok ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-3">{t("الطلبات", "Orders")}</dt><dd className="nums font-bold" data-testid="usage-orders">{usage.orders}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-3">{t("الاشتراكات", "Subscriptions")}</dt><dd className="nums font-bold" data-testid="usage-subscriptions">{usage.subscriptions}</dd></div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">{t("الموقع", "Website")}</dt>
                  <dd className="text-end" data-testid="usage-website">
                    {pkg.isActive ? (
                      <span className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs font-semibold">
                        <a href="/plans" target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">/plans</a>
                        <a href={`/checkout?plan=${encodeURIComponent(pkg.slug)}`} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline" dir="ltr">/checkout?plan={pkg.slug}</a>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">{t("مخفية (موقوفة)", "Hidden (inactive)")}</span>
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
            <p className="mt-3 text-xs leading-5 text-ink-3">{t("الطلبات والإيصالات تحتفظ باسمها وسعرها وقت الشراء؛ تعديل الباقة لا يغيّرها.", "Orders and receipts keep the name and price from the time of purchase; editing the package doesn't change them.")}</p>
          </SectionCard>

          <SectionCard title={t("الأجهزة المتوافقة", "Compatible devices")} icon={<Link2 size={14} aria-hidden />} action={{ href: "/admin/catalogue/compatibility", label: t("التوافق", "Compatibility") }} testId="catalogue-compat">
            {!compatibility.ok ? (
              <SectionError label={t("تعذر تحميل الأجهزة", "Couldn't load devices")} />
            ) : pkg.serviceType !== "VIP" ? (
              <EmptyLine>{t("باقات IPTV لا تحتاج جهازًا.", "IPTV packages don't use devices.")}</EmptyLine>
            ) : compatibility.linked.length ? (
              <>
                <div className="flex flex-wrap gap-1.5">{compatibility.linked.map((device) => <CompatChip key={device.id} name={device.name} active={device.isActive} href={`/admin/catalogue/devices/${device.id}`} t={t} />)}</div>
                {compatibility.unsellable && pkg.isActive ? <p className="mt-3 text-xs font-semibold text-warning">{t("كل أجهزتها موقوفة: لا يمكن شراؤها الآن.", "All its devices are inactive: it can't be bought right now.")}</p> : null}
              </>
            ) : (
              <EmptyLine>{t("لا توجد أجهزة متوافقة", "No compatible devices")}</EmptyLine>
            )}
          </SectionCard>

          <SectionCard title={t("كما يراها العميل", "What customers see")} icon={<Eye size={14} aria-hidden />} testId="catalogue-preview">
            <div inert className="pointer-events-none select-none">
              <PackageCard
                lang={lang}
                href="#"
                pkg={{
                  id: pkg.id,
                  name: pkg.name,
                  slug: pkg.slug,
                  serviceType: pkg.serviceType,
                  price: pkg.price,
                  durationMonths: pkg.durationMonths,
                  durationLabel: pkg.durationLabel,
                  description: pkg.description,
                  features: splitLines(pkg.specifications),
                  notes: pkg.notes,
                  imageUrl: safeHref(pkg.imageUrl),
                  salesCount: 0,
                  isPopular: false,
                }}
              />
            </div>
            {pkg.isActive ? null : <p className="mt-3 text-xs text-ink-3">{t("موقوفة: لا تظهر في الموقع حاليًا.", "Inactive: not shown on the website right now.")}</p>}
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
