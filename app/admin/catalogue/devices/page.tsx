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
import { DEVICE_VIEWS, parseCatalogueQuery } from "@/src/lib/catalogue";
import { formatDate, formatPrice } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { listDevicesForConsole } from "@/src/server/catalogue";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الأجهزة — الكتالوج" };

export default async function CatalogueDevicesPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; type?: string; page?: string }> }) {
  const params = await searchParams;
  const { allowed } = await requireStaffPage("/admin/catalogue/devices", "catalogue");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const query = parseCatalogueQuery(DEVICE_VIEWS, params);
  const result = await listDevicesForConsole(query);
  const href = (view: string) => `/admin/catalogue/devices?${new URLSearchParams({ ...(query.q ? { q: query.q } : {}), ...(query.type !== "all" ? { type: query.type } : {}), view }).toString()}`;
  const tabs = [
    { key: "all", label: t("الكل", "All") },
    { key: "active", label: t("فعّالة", "Active") },
    { key: "inactive", label: t("موقوفة", "Inactive") },
    { key: "unlinked", label: t("غير مرتبطة بباقة", "Not linked to a package") },
  ];

  return (
    <div className="space-y-5" data-testid="catalogue-devices">
      <CatalogueHeader
        active="devices"
        t={t}
        title={t("الأجهزة", "Devices")}
        description={result.ok ? <span data-testid="catalogue-count">{t(`${result.rows.length} نتيجة`, `${result.rows.length} results`)}</span> : undefined}
        actions={<LinkButton href="/admin/catalogue/devices/new" size="sm"><Plus size={15} aria-hidden /> {t("جهاز جديد", "New device")}</LinkButton>}
      />

      <LinkTabs label={t("الحالة", "Status")} active={query.view} tabs={tabs.map((tab) => ({ ...tab, href: href(tab.key) }))} />

      <form role="search" className="glass-soft flex flex-wrap gap-2 rounded-2xl p-2" data-testid="catalogue-search-form">
        <input type="hidden" name="view" value={query.view} />
        <label className="relative min-w-0 flex-[2_1_14rem]">
          <span className="sr-only">{t("بحث", "Search")}</span>
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={query.q} data-testid="catalogue-search" placeholder={t("اسم الجهاز، الـ Slug أو #رقم", "Device name, slug or #id")} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none" />
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
        <SectionError label={t("تعذر تحميل الأجهزة", "Couldn't load devices")} />
      ) : (
        <DevicesTable rows={result.rows} page={query.page} t={t} lang={lang} params={{ q: query.q || undefined, view: query.view, type: query.type !== "all" ? query.type : undefined }} />
      )}
    </div>
  );
}

type Rows = Extract<Awaited<ReturnType<typeof listDevicesForConsole>>, { ok: true }>["rows"];

function DevicesTable({ rows, page: pageParam, t, lang, params }: { rows: Rows; page: number; t: (ar: string, en: string) => string; lang: "ar" | "en"; params: Record<string, string | undefined> }) {
  const { items, page, pageCount } = paginate(rows, pageParam, 20);

  return (
    <>
      <DataTable
        caption={t("الأجهزة", "Devices")}
        rows={items}
        rowKey={(row) => row.id}
        empty={<EmptyState title={t("لا توجد أجهزة مطابقة", "No matching devices")} description={t("جرّب بحثًا أو فلترًا آخر.", "Try another search or filter.")} />}
        columns={[
          {
            key: "name",
            header: t("الجهاز", "Device"),
            cell: (row) => (
              <Link href={`/admin/catalogue/devices/${row.id}`} className="flex min-w-0 items-center gap-3 hover:text-brand-ink" data-testid="catalogue-device-link">
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
          { key: "status", header: t("الحالة", "Status"), cell: (row) => <ActiveBadge active={row.isActive} t={t} /> },
          {
            key: "packages",
            header: t("الباقات المتوافقة", "Compatible packages"),
            hideOnMobile: true,
            cell: (row) =>
              row.packages.length ? (
                <span className="flex flex-wrap gap-1.5" data-testid="catalogue-package-count" data-count={row.packages.length}>
                  {row.packages.map((pkg) => <CompatChip key={pkg.id} name={pkg.name} active={pkg.isActive} t={t} />)}
                </span>
              ) : (
                <span className="text-xs text-ink-3" data-testid="catalogue-package-count" data-count={0}>{t("غير مرتبط بباقة", "Not linked")}</span>
              ),
          },
          { key: "updated", header: t("آخر تعديل", "Updated"), hideOnMobile: true, cell: (row) => <span className="nums text-xs">{formatDate(row.updatedAt, lang)}</span> },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} basePath="/admin/catalogue/devices" params={params} lang={lang} />
    </>
  );
}
