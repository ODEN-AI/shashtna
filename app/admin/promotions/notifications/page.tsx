import type { Metadata } from "next";
import { Search } from "lucide-react";

import { sendNotificationAction } from "@/app/admin/actions";
import { PromotionsHeader } from "@/app/components/admin/promotions/PromotionsUI";
import { SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { DataTable } from "@/app/ui/DataTable";
import { Field, Input, Select, Textarea } from "@/app/ui/Field";
import { Pagination } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime } from "@/src/lib/i18n";
import { hasPermission } from "@/src/lib/roles";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { NOTIFICATION_PAGE, listNotificationsConsole } from "@/src/server/promotions-console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإشعارات — العروض والمحتوى" };

/**
 * In-account notifications — the existing Notification table. The system
 * creates them for order changes, activations, support replies and expiry
 * reminders; staff can send one to a customer (sendNotificationAction).
 * There is no push / WhatsApp / broadcast delivery.
 */
export default async function PromotionsNotificationsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string; phone?: string }> }) {
  const params = await searchParams;
  const { user, allowed } = await requireStaffPage("/admin/promotions/notifications", "support");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const page = Number(params.page);
  const query = {
    q: String(params.q ?? "").trim().slice(0, 80),
    type: /^[A-Z_]{1,40}$/.test(String(params.type ?? "")) ? String(params.type) : "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
  const result = await listNotificationsConsole(query);

  return (
    <div className="space-y-5" data-testid="promo-notifications-page">
      <PromotionsHeader
        active="notifications"
        t={t}
        can={(permission) => hasPermission(user.role, permission)}
        title={t("الإشعارات داخل الحساب", "In-account notifications")}
        description={result?.ok ? <span data-testid="promo-notif-count">{t(`${result.data.total} إشعار`, `${result.data.total} notifications`)}</span> : undefined}
      />
      <p className="text-sm text-ink-3">{t("تظهر داخل حساب العميل على الموقع. ماكو إرسال واتساب/تيليجرام أو إشعارات push آلية حاليًا.", "They appear in the customer's account on the website. There is no automated WhatsApp/Telegram or push delivery.")}</p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <form role="search" className="glass-soft grid gap-2 rounded-2xl p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]" data-testid="notif-search-form">
            <label className="relative min-w-0">
              <span className="sr-only">{t("بحث بالعنوان", "Search by title")}</span>
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <input name="q" defaultValue={query.q} data-testid="notif-search" placeholder={t("ابحث بالعنوان", "Search by title")} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none" />
            </label>
            <label className="min-w-0">
              <span className="sr-only">{t("النوع", "Type")}</span>
              <Select name="type" defaultValue={query.type} className="py-2 text-sm" data-testid="notif-type">
                <option value="all">{t("كل الأنواع", "All types")}</option>
                {(result?.ok ? result.data.types : []).map((type) => <option key={type} value={type}>{type}</option>)}
              </Select>
            </label>
            <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("بحث", "Search")}</button>
          </form>

          {!result?.ok ? (
            <SectionError label={t("تعذر تحميل الإشعارات.", "Couldn't load notifications.")} />
          ) : (
            <>
              <DataTable
                caption={t("الإشعارات", "Notifications")}
                rows={result.data.rows}
                rowKey={(row) => row.id}
                empty={<EmptyState title={t("لا توجد إشعارات مطابقة", "No matching notifications")} />}
                columns={[
                  {
                    key: "title",
                    header: t("الإشعار", "Notification"),
                    cell: (row) => (
                      <span className="block min-w-0" data-testid="notif-row">
                        <span className="block font-bold text-ink">{row.title}</span>
                        <span className="line-clamp-2 block text-xs text-ink-2">{row.body}</span>
                      </span>
                    ),
                  },
                  { key: "type", header: t("النوع", "Type"), cell: (row) => <span className="text-xs font-semibold">{row.type}</span> },
                  { key: "customer", header: t("العميل", "Customer"), cell: (row) => <span className="text-sm">{row.customer.name}</span> },
                  { key: "state", header: t("الحالة", "State"), hideOnMobile: true, cell: (row) => <span className="text-xs">{row.read ? t("مقروء", "Read") : t("غير مقروء", "Unread")}</span> },
                  { key: "date", header: t("التاريخ", "Date"), hideOnMobile: true, cell: (row) => <span className="nums text-xs">{formatDateTime(row.createdAt, lang)}</span> },
                ]}
              />
              <Pagination page={query.page} pageCount={Math.max(1, Math.ceil(result.data.total / NOTIFICATION_PAGE))} basePath="/admin/promotions/notifications" params={{ q: query.q || undefined, type: query.type !== "all" ? query.type : undefined }} lang={lang} />
            </>
          )}
        </div>

        <SectionCard title={t("إرسال إشعار لعميل", "Notify a customer")} className="order-first h-fit xl:order-none" testId="notif-send">
          <ActionForm action={sendNotificationAction} resetOnSuccess className="space-y-4">
            <Field label={t("رقم هاتف العميل", "Customer phone")} htmlFor="notif-phone" required>
              <Input id="notif-phone" name="phone" defaultValue={params.phone ?? ""} dir="ltr" className="text-start" />
            </Field>
            <Field label={t("العنوان", "Title")} htmlFor="notif-title" required>
              <Input id="notif-title" name="title" maxLength={120} />
            </Field>
            <Field label={t("النص", "Message")} htmlFor="notif-body" required>
              <Textarea id="notif-body" name="body" rows={4} maxLength={600} />
            </Field>
            <Field label={t("رابط داخلي (اختياري)", "Internal link (optional)")} htmlFor="notif-link" hint={t("مسار يبدأ بـ / مثل /subscriptions", "A path starting with / like /subscriptions")}>
              <Input id="notif-link" name="link" dir="ltr" className="text-start" />
            </Field>
            <SubmitButton pendingLabel={t("جاري الإرسال...", "Sending...")}>{t("إرسال", "Send")}</SubmitButton>
          </ActionForm>
        </SectionCard>
      </div>
    </div>
  );
}
