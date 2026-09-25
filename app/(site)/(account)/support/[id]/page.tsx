import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { closeTicketAction, replyTicketAction } from "@/app/(site)/(account)/actions";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge, StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card } from "@/app/ui/Card";
import { Field, Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { TicketThread } from "@/app/ui/TicketThread";
import { formatOrderNumber } from "@/src/lib/order-status";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS, getTicketForUser } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تذكرة دعم" };

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const ticketId = decodeURIComponent(id);
  const user = await requireCustomer(`/support/${encodeURIComponent(ticketId)}`);
  const ticket = await getTicketForUser(user.id, ticketId);

  if (!ticket) {
    notFound();
  }

  const { t, lang } = await getI18n();
  const closed = ticket.status === "CLOSED";
  const context = ticket.context;

  return (
    <div className="space-y-6">
      <LinkButton href="/support" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("الدعم الفني", "Support")}
      </LinkButton>

      {created === "1" ? (
        <Notice tone="success" title={t("تم إرسال التذكرة", "Ticket sent")}>
          {t("فريق الدعم راح يرد هنا ويوصلك إشعار.", "The support team will reply here and you'll be notified.")}
        </Notice>
      ) : null}

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink">{ticket.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <span className="nums" dir="ltr">{ticket.id}</span>
              <Badge>{TICKET_CATEGORIES.find((item) => item.value === ticket.category)?.[lang] ?? ticket.category}</Badge>
              {context?.subscriptionId ? (
                <Link href={`/subscriptions/${context.subscriptionId}`} className="underline-offset-4 hover:underline">
                  {t("اشتراك مرتبط", "Linked subscription")}
                </Link>
              ) : null}
              {context?.orderId ? (
                <Link href={`/orders/${context.orderId}`} className="nums underline-offset-4 hover:underline">
                  {formatOrderNumber(context.orderId)}
                </Link>
              ) : null}
              {context?.app ? <span>{context.app}</span> : null}
              {context?.device ? <span>{context.device}</span> : null}
            </div>
          </div>
          <StatusBadge status={ticket.status} label={TICKET_STATUS_LABELS[ticket.status]?.[lang] ?? ticket.status} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <TicketThread messages={ticket.messages} lang={lang} perspective="CUSTOMER" />
      </Card>

      <Card className="p-5 sm:p-6">
        {closed ? (
          <p className="mb-4 flex items-center gap-2 text-sm text-ink-3">
            <CheckCircle2 size={16} className="text-success" aria-hidden />
            {t("التذكرة مغلقة. إذا رديت، راح تنفتح من جديد.", "This ticket is closed. Replying will reopen it.")}
          </p>
        ) : null}
        <ActionForm action={replyTicketAction} resetOnSuccess className="space-y-4">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <Field label={t("ردك", "Your reply")} htmlFor="message" required>
            <Textarea id="message" name="message" required minLength={2} maxLength={4000} rows={4} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SubmitButton pendingLabel={t("جاري الإرسال...", "Sending...")}>{t("إرسال الرد", "Send reply")}</SubmitButton>
          </div>
        </ActionForm>
        {!closed ? (
          <form action={closeTicketAction} className="mt-4 border-t border-line pt-4">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <SubmitButton variant="ghost" size="sm" pendingLabel={t("جاري الإغلاق...", "Closing...")}>
              {t("انحلت المشكلة؟ أغلق التذكرة", "Solved? Close the ticket")}
            </SubmitButton>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
