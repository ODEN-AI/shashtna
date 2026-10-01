import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { ActiveBadge, CatalogueHeader, CompatChip, ProductThumb, TypeBadge } from "@/app/components/admin/catalogue/CatalogueUI";
import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { LinkButton } from "@/app/ui/Button";
import { DataTable } from "@/app/ui/DataTable";
import { Select } from "@/app/ui/Field";
import { Pagination, paginate } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { PACKAGE_VIEWS, parseCatalogueQuery } from "@/src/lib/catalogue";
import { formatDate, formatPrice } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { listPackagesForConsole } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الباقات — الكتالوج" };

export default async function CataloguePackagesPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; type?: string; page?: string }> }) {
  const params = await searchParams;
  const { allowed } = await requireStaffPage("/admin/catalogue/packages", "catalogue");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const query = parseCatalogueQuery(PACKAGE_VIEWS, params);
  const result = await listPackagesForConsole(query);
  const href = (view: string) => `/admin/catalogue/packages?${new URLSearchParams({ ...(query.q ? { q: query.q } : {}), ...(query.type !== "all" ? { type: query.type } : {}), view }).toString()}`;
  const tabs = [
    { key: "all", label: t("الكل", "All") },
    { key: "active", label: t("فعّالة", "Active") },
    { key: "inactive", label: t("موقوفة", "Inactive") },
    { key: "no-devices", label: t("VIP بلا جهاز", "VIP without device") },
  ];

  return (
    <div className="space-y-5" data-testid="catalogue-packages">
      <CatalogueHeader
        active="packages"
        t={t}
        title={t("الباقات", "Packages")}
        description={result.ok ? <span data-testid="catalogue-count">{t(`${result.rows.length} نتيجة`, `${result.rows.length} results`)}</span> : undefined}
        actions={<LinkButton href="/admin/catalogue/packages/new" size="sm"><Plus size={15} aria-hidden /> {t("باقة جديدة", "New package")}</LinkButton>}
      />

      <LinkTabs label={t("الحالة", "Status")} active={query.view} tabs={tabs.map((tab) => ({ ...tab, href: href(tab.key) }))} />

      <form role="search" className="glass-soft flex flex-wrap gap-2 rounded-2xl p-2" data-testid="catalogue-search-form">
        <input type="hidden" name="view" value={query.view} />
        <label className="relative min-w-0 flex-[2_1_14rem]">
          <span className="sr-only">{t("بحث", "Search")}</span>
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={query.q} data-testid="catalogue-search" placeholder={t("اسم الباقة، الـ Slug أو #رقم", "Package name, slug or #id")} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none" />
        </label>
        <label className="min-w-0 flex-[1_1_8rem]">
          <span className="sr-only">{t("نوع الخدمة", "Service type")}</span>
          <Select name="type" defaultValue={query.type} className="py-2 text-sm" data-testid="catalogue-type">
            <option value="all">{t("كل الأنواع", "All types")}</option>
            <option value="IPTV">IPTV</option>
            <option value="VIP">VIP</option>
          </Select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("بحث", "Search")}</button>
      </form>

      {!result.ok ? (
        <SectionError label={t("تعذر تحميل الباقات.", "Couldn't load packages.")} />
      ) : (
        <PackagesTable rows={result.rows} page={query.page} t={t} lang={lang} params={{ q: query.q || undefined, view: query.view, type: query.type !== "all" ? query.type : undefined }} />
      )}
    </div>
  );
}

type Rows = Extract<Awaited<ReturnType<typeof listPackagesForConsole>>, { ok: true }>["rows"];

function PackagesTable({ rows, page: pageParam, t, lang, params }: { rows: Rows; page: number; t: (ar: string, en: string) => string; lang: "ar" | "en"; params: Record<string, string | undefined> }) {
  const { items, page, pageCount } = paginate(rows, pageParam, 20);

  return (
    <>
      <DataTable
        caption={t("الباقات", "Packages")}
        rows={items}
        rowKey={(row) => row.id}
        empty={<EmptyState title={t("لا توجد باقات مطابقة", "No matching packages")} description={t("جرّب بحثًا أو فلترًا آخر.", "Try another search or filter.")} />}
        columns={[
          {
            key: "name",
            header: t("الباقة", "Package"),
            cell: (row) => (
              <Link href={`/admin/catalogue/packages/${row.id}`} className="flex min-w-0 items-center gap-3 hover:text-brand-ink" data-testid="catalogue-package-link">
                <ProductThumb src={row.imageUrl} />
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">{row.name}</span>
                  <span className="nums block truncate text-xs text-ink-3" dir="ltr">#{row.id} · {row.slug}</span>
                </span>
              </Link>
            ),
          },
          { key: "type", header: t("النوع", "Type"), cell: (row) => <TypeBadge type={row.serviceType} /> },
          { key: "price", header: t("السعر", "Price"), cell: (row) => <span className="nums font-semibold" data-testid="catalogue-price">{formatPrice(row.price, lang)}</span> },
          { key: "duration", header: t("المدة", "Duration"), hideOnMobile: true, cell: (row) => <span className="nums text-sm">{row.durationLabel || t(`${row.durationMonths} شهر`, `${row.durationMonths} months`)}</span> },
          { key: "status", header: t("الحالة", "Status"), cell: (row) => <ActiveBadge active={row.isActive} t={t} /> },
          {
            key: "devices",
            header: t("الأجهزة المتوافقة", "Compatible devices"),
            hideOnMobile: true,
            cell: (row) =>
              row.serviceType !== "VIP" ? (
                <span className="text-xs text-ink-3">{t("غير مطلوب", "Not needed")}</span>
              ) : row.devices.length ? (
                <span className="flex flex-wrap gap-1.5" data-testid="catalogue-device-count" data-count={row.devices.length}>
                  {row.devices.map((device) => <CompatChip key={device.id} name={device.name} active={device.isActive} t={t} />)}
                </span>
              ) : (
                <span className="text-xs font-semibold text-warning" data-testid="catalogue-device-count" data-count={0}>{t("لا توجد أجهزة متوافقة", "No compatible devices")}</span>
              ),
          },
          { key: "updated", header: t("آخر تعديل", "Updated"), hideOnMobile: true, cell: (row) => <span className="nums text-xs">{formatDate(row.updatedAt, lang)}</span> },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} basePath="/admin/catalogue/packages" params={params} lang={lang} />
    </>
  );
}
