import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";

import { logRenewalContactAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { StatusBadge } from "@/app/ui/Badge";
import { WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { Input } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { LinkTabs } from "@/app/ui/Tabs";
import { formatDate } from "@/src/lib/i18n";
import { SUBSCRIPTION_STATE_LABELS, daysRemaining, deriveSubscriptionState } from "@/src/lib/subscription-state";
import { db } from "@/src/prisma/db";
import { customersById } from "@/src/server/admin-data";
import { listRenewalsDue } from "@/src/server/admin-queues";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { whatsappLink } from "@/src/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التجديدات المستحقة" };

export default async function RenewalsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const { allowed } = await requireStaffPage("/admin/renewals", "subscriptions");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const all = await listRenewalsDue();
  const [customers, contacted] = await Promise.all([
    customersById(all.map((item) => item.userId)),
    db.orm.public.ActivityEvent.where({ action: "RENEWAL_CONTACTED" }).orderBy((event) => event.createdAt.desc()).limit(500).all(),
  ]);
  const lastContact = new Map<string, string>();

  for (const event of contacted) {
    if (event.entityId && !lastContact.has(event.entityId)) {
      lastContact.set(event.entityId, String(event.createdAt));
    }
  }

  const upcoming = all.filter((item) => deriveSubscriptionState(item) !== "EXPIRED");
  const expired = all.filter((item) => deriveSubscriptionState(item) === "EXPIRED");
  const active = view === "expired" ? "expired" : "upcoming";
  const rows = active === "expired" ? [...expired].reverse() : upcoming;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("التجديدات المستحقة", "Renewals due")}
        description={t(
          "اشتراكات تنتهي خلال 14 يوم أو انتهت خلال آخر 30 يوم. العملاء يشوفون تذكير داخل حسابهم؛ التواصل المباشر يدوي من هنا.",
          "Subscriptions ending in the next 14 days or that ended in the last 30. Customers see an in-account reminder; direct contact is manual from here.",
        )}
      />
      <LinkTabs
        label={t("العرض", "View")}
        active={active}
        tabs={[
          { key: "upcoming", href: "/admin/renewals", label: t("تنتهي قريبًا", "Ending soon"), count: upcoming.length },
          { key: "expired", href: "/admin/renewals?view=expired", label: t("انتهت مؤخرًا", "Recently ended"), count: expired.length },
        ]}
      />

      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((subscription) => {
            const customer = customers.get(subscription.userId);
            const state = deriveSubscriptionState(subscription);
            const contactedAt = lastContact.get(String(subscription.id));
            const message = customer
              ? `مرحبًا ${customer.name}، معك فريق شاشتنا. اشتراك «${subscription.packageName}» ${state === "EXPIRED" ? "انتهى" : `ينتهي بتاريخ ${String(subscription.expiryDate).slice(0, 10)}`}. تكدر تجدده من حسابك: https://shashtna.netlify.app/subscriptions/${subscription.id}`
              : "";
            const wa = customer ? whatsappLink(customer.phone.replace(/^0/, "964"), message) : null;

            return (
              <li key={subscription.id} className="surface rounded-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/admin/customers/${subscription.userId}`} className="font-bold text-ink hover:text-brand-ink">
                      {customer?.name ?? "—"}
                    </Link>
                    <p className="nums text-xs text-ink-3" dir="ltr">{customer?.phone}</p>
                    <p className="mt-2 text-sm text-ink-2">
                      {subscription.packageName} · {t("ينتهي ", "Ends ")}
                      <span className="nums">{formatDate(subscription.expiryDate, lang)}</span>
                    </p>
                    {contactedAt ? (
                      <p className="mt-1 text-xs text-success">
                        {t("آخر تواصل: ", "Last contacted: ")}
                        <span className="nums">{formatDate(contactedAt, lang)}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={state} label={SUBSCRIPTION_STATE_LABELS[state][lang]} />
                    {state !== "EXPIRED" ? (
                      <span className="nums text-sm font-bold text-warning">
                        {daysRemaining(subscription.expiryDate)} {t("يوم", "d")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  {wa ? (
                    <LinkButton href={wa} external variant="secondary" size="sm">
                      <WhatsAppIcon size={15} />
                      WhatsApp
                    </LinkButton>
                  ) : null}
                  {customer ? (
                    <LinkButton href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} external variant="secondary" size="sm">
                      <Phone size={15} aria-hidden />
                      {t("اتصال", "Call")}
                    </LinkButton>
                  ) : null}
                  <ActionForm action={logRenewalContactAction} className="flex flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="subscriptionId" value={subscription.id} />
                    <Input name="note" placeholder={t("ملاحظة (اختياري)", "Note (optional)")} className="h-9 min-w-40 flex-1 py-0 text-sm" maxLength={200} aria-label={t("ملاحظة", "Note")} />
                    <SubmitButton size="sm" variant="ghost">{t("تسجيل تواصل", "Log contact")}</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={t("ماكو اشتراكات بهذا القسم", "Nothing in this view")} />
      )}
    </div>
  );
}
