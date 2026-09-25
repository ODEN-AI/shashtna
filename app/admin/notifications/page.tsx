import type { Metadata } from "next";

import { sendNotificationAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Input, Textarea } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { customersById } from "@/src/server/admin-data";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإشعارات" };

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  const { allowed } = await requireStaffPage("/admin/notifications", "support");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const recent = await db.orm.public.Notification.orderBy((item) => item.id.desc()).limit(40).all();
  const customers = await customersById(recent.map((item) => item.userId));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الإشعارات", "Notifications")}
        description={t(
          "إشعارات داخل حساب العميل بالموقع. النظام يرسل تلقائيًا عند تغير حالة الطلب، التفعيل، ردود الدعم، وتذكيرات الانتهاء. ماكو إرسال واتساب/تيليجرام آلي حاليًا.",
          "In-account notifications on the website. The system sends them automatically for order status changes, activations, support replies and expiry reminders. There is no automated WhatsApp/Telegram delivery yet.",
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card className="p-6">
          <CardHeader title={t("آخر الإشعارات المرسلة", "Recently sent")} />
          {recent.length ? (
            <ul className="mt-4 divide-y divide-line">
              {recent.map((item) => (
                <li key={item.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-ink">{item.title}</span>
                    <span className="nums text-xs text-ink-3">{formatDateTime(item.createdAt, lang)}</span>
                  </div>
                  <p className="mt-1 text-ink-2">{item.body}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {customers.get(item.userId)?.name ?? `#${item.userId}`} · {item.type} · {item.readAt ? t("مقروء", "Read") : t("غير مقروء", "Unread")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact className="mt-4" title={t("ماكو إشعارات بعد", "No notifications yet")} />
          )}
        </Card>
        <Card className="h-fit p-6">
          <CardHeader title={t("إرسال إشعار لعميل", "Notify a customer")} />
          <ActionForm action={sendNotificationAction} resetOnSuccess className="mt-5 space-y-4">
            <Field label={t("رقم هاتف العميل", "Customer phone")} htmlFor="phone" required>
              <Input id="phone" name="phone" required defaultValue={phone ?? ""} dir="ltr" className="text-start" />
            </Field>
            <Field label={t("العنوان", "Title")} htmlFor="title" required>
              <Input id="title" name="title" required maxLength={120} />
            </Field>
            <Field label={t("النص", "Message")} htmlFor="body" required>
              <Textarea id="body" name="body" required rows={4} maxLength={600} />
            </Field>
            <Field label={t("رابط داخلي (اختياري)", "Internal link (optional)")} htmlFor="link" hint={t("مثال: /subscriptions", "e.g. /subscriptions")}>
              <Input id="link" name="link" dir="ltr" className="text-start" />
            </Field>
            <SubmitButton pendingLabel={t("جاري الإرسال...", "Sending...")}>{t("إرسال", "Send")}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
