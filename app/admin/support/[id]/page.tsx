import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { replyTicketAdminAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge, StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Select, Textarea } from "@/app/ui/Field";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { TicketThread } from "@/app/ui/TicketThread";
import { formatDate } from "@/src/lib/i18n";
import { formatOrderNumber } from "@/src/lib/order-status";
import { getSupportTicket } from "@/src/lib/support-store";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تذكرة دعم" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticketId = decodeURIComponent(id);
  const { allowed } = await requireStaffPage(`/admin/support/${encodeURIComponent(ticketId)}`, "support");

  if (!allowed) {
    return <Forbidden />;
  }

  const ticket = await getSupportTicket(ticketId);

  if (!ticket) {
    notFound();
  }

  const [{ t, lang }, subscriptions] = await Promise.all([getI18n(), listSubscriptionsForUser(ticket.userId).catch(() => [])]);
  const linked = ticket.context?.subscriptionId ? subscriptions.find((item) => item.id === ticket.context!.subscriptionId) : undefined;

  return (
    <div className="space-y-6">
      <LinkButton href="/admin/support" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("تذاكر الدعم", "Support tickets")}
      </LinkButton>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-ink">{ticket.subject}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <span className="nums" dir="ltr">{ticket.id}</span>
                  <Badge>{TICKET_CATEGORIES.find((item) => item.value === ticket.category)?.[lang] ?? ticket.category}</Badge>
                </p>
              </div>
              <StatusBadge status={ticket.status} label={TICKET_STATUS_LABELS[ticket.status]?.[lang] ?? ticket.status} />
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <TicketThread messages={ticket.messages} lang={lang} perspective="ADMIN" />
          </Card>
          <Card className="p-5 sm:p-6">
            <ActionForm action={replyTicketAdminAction} resetOnSuccess className="space-y-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Field label={t("الرد", "Reply")} htmlFor="message" hint={t("العميل يستلم إشعار بحسابه.", "The customer is notified in their account.")}>
                <Textarea id="message" name="message" rows={4} maxLength={4000} />
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t("الحالة", "Status")} htmlFor="status" className="min-w-44">
                  <Select id="status" name="status" defaultValue="">
                    <option value="">{t("بدون تغيير", "No change")}</option>
                    <option value="OPEN">{TICKET_STATUS_LABELS.OPEN[lang]}</option>
                    <option value="IN_PROGRESS">{TICKET_STATUS_LABELS.IN_PROGRESS[lang]}</option>
                    <option value="CLOSED">{TICKET_STATUS_LABELS.CLOSED[lang]}</option>
                  </Select>
                </Field>
                <SubmitButton pendingLabel={t("جاري الإرسال...", "Sending...")}>{t("إرسال / حفظ", "Send / save")}</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <CardHeader title={t("العميل", "Customer")} />
            <Link href={`/admin/customers/${ticket.userId}`} className="mt-4 block font-bold text-ink hover:text-brand-ink">
              {ticket.userName}
            </Link>
            <p className="nums text-sm text-ink-2" dir="ltr">{ticket.userPhone}</p>
          </Card>
          <Card className="p-6">
            <CardHeader title={t("السياق", "Context")} />
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("الاشتراك", "Subscription")}</dt>
                <dd className="text-end font-semibold text-ink">
                  {linked ? `${linked.packageName} · ${t("ينتهي", "ends")} ${formatDate(linked.expiryDate, lang)}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("الطلب", "Order")}</dt>
                <dd className="nums text-end font-semibold text-ink">
                  {ticket.context?.orderId ? (
                    <Link href={`/admin/orders/${ticket.context.orderId}`} className="hover:text-brand-ink">
                      {formatOrderNumber(ticket.context.orderId)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("التطبيق", "App")}</dt>
                <dd className="text-end font-semibold text-ink">{ticket.context?.app ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("الجهاز", "Device")}</dt>
                <dd className="text-end font-semibold text-ink">{ticket.context?.device ?? "—"}</dd>
              </div>
            </dl>
            {ticket.context?.diagnostics ? (
              <p className="mt-4 rounded-xl bg-surface-3 p-3 text-xs leading-6 text-ink-2">
                <span className="font-bold text-ink">{t("تشخيص التطبيق: ", "App diagnostics: ")}</span>
                {ticket.context.diagnostics}
              </p>
            ) : null}
            {subscriptions.length && !linked ? (
              <p className="mt-4 text-xs text-ink-3">
                {t(`عند العميل ${subscriptions.length} اشتراك.`, `The customer has ${subscriptions.length} subscription(s).`)}
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
