import type { Metadata } from "next";
import Link from "next/link";
import { Headphones, MessageSquarePlus } from "lucide-react";

import { StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState, ErrorState } from "@/app/ui/States";
import { formatDateTime } from "@/src/lib/i18n";
import type { SupportTicket } from "@/src/lib/support-store";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS, listTicketsForUser } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الدعم الفني" };

export default async function SupportPage() {
  const user = await requireCustomer("/support");
  const { t, lang } = await getI18n();

  let tickets: SupportTicket[] | null = null;

  try {
    tickets = await listTicketsForUser(user.id);
  } catch (error) {
    console.error("SUPPORT_LIST_ERROR:", error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الدعم الفني", "Support")}
        description={t("تذاكرك وردود فريق الدعم. توصلك إشعارات عند كل رد.", "Your tickets and replies from our team. You're notified of every reply.")}
        actions={
          <LinkButton href="/support/new">
            <MessageSquarePlus size={16} aria-hidden />
            {t("تذكرة جديدة", "New ticket")}
          </LinkButton>
        }
      />

      {tickets === null ? (
        <ErrorState title={t("تعذر تحميل التذاكر", "Tickets couldn't be loaded")} action={<LinkButton href="/support" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<Headphones size={22} aria-hidden />}
          title={t("ماكو تذاكر بعد", "No tickets yet")}
          description={t("إذا واجهتك مشكلة، شوف حل المشاكل أولًا أو افتح تذكرة.", "If something's wrong, check Troubleshooting first or open a ticket.")}
          action={
            <>
              <LinkButton href="/support/new">{t("تذكرة جديدة", "New ticket")}</LinkButton>
              <LinkButton href="/help/troubleshooting" variant="secondary">{t("حل المشاكل", "Troubleshooting")}</LinkButton>
            </>
          }
        />
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/${encodeURIComponent(ticket.id)}`}
                className="surface flex flex-col gap-3 rounded-card p-5 transition hover:border-brand/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{ticket.subject}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {TICKET_CATEGORIES.find((category) => category.value === ticket.category)?.[lang] ?? ticket.category}
                    {" · "}
                    <span className="nums">{formatDateTime(ticket.updatedAt, lang)}</span>
                    {" · "}
                    {ticket.lastSender === "ADMIN" ? t("آخر رد من الدعم", "Last reply from support") : t("بانتظار رد الدعم", "Waiting for support")}
                  </p>
                </div>
                <StatusBadge status={ticket.status} label={TICKET_STATUS_LABELS[ticket.status]?.[lang] ?? ticket.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
