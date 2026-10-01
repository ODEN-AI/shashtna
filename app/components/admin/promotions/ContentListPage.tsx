import Link from "next/link";
import { ImageOff, Plus, Search, Video } from "lucide-react";

import { LifecycleBadge, PromotionsHeader, SurfaceList, contentLabels } from "@/app/components/admin/promotions/PromotionsUI";
import { SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { LinkButton } from "@/app/ui/Button";
import { DataTable } from "@/app/ui/DataTable";
import { Select } from "@/app/ui/Field";
import { Pagination, paginate } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { parseContentQuery, type ContentGroup } from "@/src/lib/content-console";
import { formatDateTime } from "@/src/lib/i18n";
import { AUDIENCES, WEBSITE_PLACEMENTS } from "@/src/lib/promotions";
import { hasPermission } from "@/src/lib/roles";
import { safeHref } from "@/src/lib/safe-href";
import { requireStaffPage } from "@/src/server/auth";
import { ANNOUNCEMENT_PLACEMENTS } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";
import { listContent } from "@/src/server/promotions-console";

const PLACEMENTS = [...WEBSITE_PLACEMENTS, ...ANNOUNCEMENT_PLACEMENTS];
const PATHS: Record<ContentGroup, string> = { all: "/admin/promotions/content", offers: "/admin/promotions/offers", announcements: "/admin/promotions/announcements" };

/** Ads / offers / news / announcements — the existing Announcement records, filtered in the URL. */
export async function ContentListPage({ group, params }: { group: ContentGroup; params: { q?: string; view?: string; placement?: string; audience?: string; page?: string } }) {
  const path = PATHS[group];
  const { user, allowed } = await requireStaffPage(path, "content");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const labels = contentLabels(t);
  const query = parseContentQuery(params, PLACEMENTS, AUDIENCES);
  const result = await listContent(group, query);
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(user.role, permission);
  const title = group === "offers" ? t("الإعلانات والعروض", "Ads & offers") : group === "announcements" ? t("الأخبار والتنبيهات", "News & announcements") : t("كل المحتوى", "All content");
  const newKind = group === "announcements" ? "NEWS" : "OFFER";
  const href = (view: string) => `${path}?${new URLSearchParams({ ...(query.q ? { q: query.q } : {}), ...(query.placement !== "all" ? { placement: query.placement } : {}), ...(query.audience !== "all" ? { audience: query.audience } : {}), view }).toString()}`;
  const tabs = [
    { key: "all", label: t("الكل", "All") },
    { key: "live", label: t("يُعرض الآن", "Live") },
    { key: "scheduled", label: t("مجدول", "Scheduled") },
    { key: "ending", label: t("ينتهي قريبًا", "Ending soon") },
    { key: "ended", label: t("انتهت مدته", "Ended") },
    { key: "inactive", label: t("متوقف", "Inactive") },
  ];

  return (
    <div className="space-y-5" data-testid="promo-list" data-group={group}>
      <PromotionsHeader
        active={group === "all" ? "content" : group}
        t={t}
        can={can}
        title={title}
        description={result.ok ? <span data-testid="promo-count">{t(`${result.rows.length} نتيجة`, `${result.rows.length} results`)}</span> : undefined}
        actions={<LinkButton href={`/admin/promotions/items/new?kind=${newKind}`} size="sm"><Plus size={15} aria-hidden /> {group === "announcements" ? t("خبر جديد", "New news item") : t("عرض جديد", "New offer")}</LinkButton>}
      />

      <LinkTabs
        label={t("الحالة", "Status")}
        active={query.view}
        tabs={tabs.map((tab) => ({ ...tab, href: href(tab.key), count: result.ok ? result.views[tab.key as keyof typeof result.views] : undefined }))}
      />

      <form role="search" className="glass-soft grid gap-2 rounded-2xl p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" data-testid="promo-search-form">
        <input type="hidden" name="view" value={query.view} />
        <label className="relative min-w-0">
          <span className="sr-only">{t("بحث", "Search")}</span>
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={query.q} data-testid="promo-search" placeholder={t("العنوان، الوصف، الزر أو #رقم", "Title, description, button or #id")} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">{t("المكان", "Placement")}</span>
          <Select name="placement" defaultValue={query.placement} className="py-2 text-sm" data-testid="promo-placement">
            <option value="all">{t("كل الأماكن", "All placements")}</option>
            {PLACEMENTS.map((value) => <option key={value} value={value}>{labels.placement[value] ?? value}</option>)}
          </Select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">{t("الجمهور", "Audience")}</span>
          <Select name="audience" defaultValue={query.audience} className="py-2 text-sm" data-testid="promo-audience">
            <option value="all">{t("كل الجماهير", "All audiences")}</option>
            {AUDIENCES.map((value) => <option key={value} value={value}>{labels.audience[value] ?? value}</option>)}
          </Select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("بحث", "Search")}</button>
      </form>

      {!result.ok ? (
        <SectionError label={t("تعذر تحميل الإعلانات.", "Couldn't load announcements.")} />
      ) : (
        <ContentTable rows={result.rows} page={query.page} path={path} params={{ q: query.q || undefined, view: query.view, placement: query.placement !== "all" ? query.placement : undefined, audience: query.audience !== "all" ? query.audience : undefined }} t={t} lang={lang} labels={labels} />
      )}
    </div>
  );
}

type Rows = Extract<Awaited<ReturnType<typeof listContent>>, { ok: true }>["rows"];

function ContentTable({ rows, page: pageParam, path, params, t, lang, labels }: { rows: Rows; page: number; path: string; params: Record<string, string | undefined>; t: (ar: string, en: string) => string; lang: "ar" | "en"; labels: ReturnType<typeof contentLabels> }) {
  const { items, page, pageCount } = paginate(rows, pageParam, 20);

  return (
    <>
      <DataTable
        caption={t("المحتوى", "Content")}
        rows={items}
        rowKey={(row) => row.id}
        empty={<EmptyState title={t("لا يوجد محتوى مطابق", "No matching content")} description={t("جرّب بحثًا أو فلترًا آخر.", "Try another search or filter.")} />}
        columns={[
          {
            key: "title",
            header: t("المحتوى", "Content"),
            cell: (row) => {
              const thumb = safeHref(row.imageUrl);

              return (
                <Link href={`/admin/promotions/items/${row.id}`} className="flex min-w-0 items-center gap-3 hover:text-brand-ink" data-testid="promo-item-link">
                  <span className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2 text-ink-3">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff size={16} aria-hidden />
                    )}
                    {String(row.mediaType).toUpperCase() === "VIDEO" ? <Video size={13} className="absolute bottom-1 end-1 text-white drop-shadow" aria-label={t("فيديو", "Video")} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{row.title}</span>
                    <span className="nums block truncate text-xs text-ink-3">#{row.id} · {labels.kind[row.kind] ?? row.kind} · {t("أولوية", "priority")} {row.priority}</span>
                  </span>
                </Link>
              );
            },
          },
          { key: "status", header: t("الحالة", "Status"), cell: (row) => <LifecycleBadge lifecycle={row.lifecycle} t={t} /> },
          { key: "placement", header: t("المكان", "Placement"), cell: (row) => <span className="text-xs">{labels.placement[row.placement] ?? row.placement}</span> },
          { key: "audience", header: t("الجمهور", "Audience"), hideOnMobile: true, cell: (row) => <span className="text-xs">{labels.audience[row.audience] ?? row.audience}</span> },
          { key: "where", header: t("يظهر في", "Shown on"), hideOnMobile: true, cell: (row) => <SurfaceList surfaces={row.surfaces} t={t} /> },
          {
            key: "schedule",
            header: t("الجدولة", "Schedule"),
            hideOnMobile: true,
            cell: (row) => (row.startsAt || row.endsAt ? <span className="nums text-xs">{row.startsAt ? formatDateTime(row.startsAt, lang) : "…"} → {row.endsAt ? formatDateTime(row.endsAt, lang) : "…"}</span> : <span className="whitespace-nowrap text-xs text-ink-3">{t("بدون جدولة", "No schedule")}</span>),
          },
        ]}
      />
      <Pagination page={page} pageCount={pageCount} basePath={path} params={params} lang={lang} />
    </>
  );
}
