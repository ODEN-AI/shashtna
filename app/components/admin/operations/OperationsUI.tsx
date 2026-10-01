import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, PackageCheck, Phone, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { logRenewalContactAction, updateLeadAction, updateOrderStatusAction } from "@/app/admin/actions";
import { StatusBadge } from "@/app/ui/Badge";
import { WhatsAppIcon } from "@/app/ui/BrandIcons";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Input, Select } from "@/app/ui/Field";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDate, formatDateTime, formatPrice, translator, type Lang } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, type OrderStatus } from "@/src/lib/order-status";
import { SUBSCRIPTION_STATE_LABELS } from "@/src/lib/subscription-state";
import type { Operations } from "@/src/server/operations";

import { OpsActionForm } from "./OpsActionForm";

/**
 * Operations Center rows. Every action goes through an EXISTING server
 * action (updateOrderStatusAction → the order state machine,
 * logRenewalContactAction, updateLeadAction), so permissions, transitions
 * and audit logging stay exactly as they are elsewhere in the admin.
 */

type Lanes = NonNullable<Extract<Operations["unpaid"], { ok: true }>>["data"];
export type PaymentItem = Lanes["payments"][number];
export type OrderItem = Lanes["orders"][number];
export type ActivationItem = NonNullable<Extract<Operations["activations"], { ok: true }>>["data"][number];
type RenewalLanes = NonNullable<Extract<Operations["renewals"], { ok: true }>>["data"];
export type RenewalItem = RenewalLanes["ending"][number];
export type TicketItem = NonNullable<Extract<Operations["support"], { ok: true }>>["data"][number];
export type LeadItem = NonNullable<Extract<Operations["leads"], { ok: true }>>["data"][number];

/** "Waiting 3 days" — how long an item has been in its queue. */
export function waitingLabel(since: string, lang: Lang, now = Date.now()) {
  const t = translator(lang);
  const at = new Date(String(since).replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).getTime();
  if (!Number.isFinite(at)) return "—";
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 60) return t(`منذ ${minutes} دقيقة`, `${minutes} min ago`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t(`منذ ${hours} ساعة`, `${hours} h ago`);
  const days = Math.round(hours / 24);

  return t(`منذ ${days} يوم`, `${days} d ago`);
}

function Row({ children, testId, className }: { children: ReactNode; testId: string; className?: string }) {
  return (
    <li className={cn("rounded-2xl border border-line/70 bg-white/[0.02] p-4", className)} data-testid={testId}>
      {children}
    </li>
  );
}

function Waiting({ since, lang }: { since: string; lang: Lang }) {
  return (
    <span className="nums inline-flex items-center gap-1 text-xs text-ink-3">
      <Clock size={12} aria-hidden /> {waitingLabel(since, lang)}
    </span>
  );
}

// ------------------------------------------------------------------ payments

/** A transfer proof to verify: proof image (protected, no-store endpoint) + confirm / reject via the state machine. */
export function PaymentCard({ item, lang }: { item: PaymentItem; lang: Lang }) {
  const t = translator(lang);
  const proofUrl = `/api/orders/${item.id}/payment-proof?v=${encodeURIComponent(item.since)}`;
  const canConfirm = item.transitions.includes("PAID");
  const canReject = item.transitions.includes("REJECTED");

  return (
    <Row testId="ops-payment" className="flex flex-col gap-4 sm:flex-row">
      <a href={proofUrl} target="_blank" rel="noreferrer" className="block h-40 shrink-0 overflow-hidden rounded-xl border border-line bg-black/30 sm:h-36 sm:w-36" aria-label={t("فتح إثبات الدفع", "Open payment proof")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={proofUrl} alt={t(`إثبات دفع الطلب ${item.number}`, `Payment proof for ${item.number}`)} loading="lazy" className="h-full w-full object-contain" />
      </a>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link href={`/admin/orders/${item.id}`} className="min-w-0 font-bold text-ink hover:text-brand-ink">
            <span className="nums">{item.number}</span> · {item.customerName ?? "—"}
          </Link>
          <StatusBadge status={item.status} label={ORDER_STATUS_LABELS[item.status]?.[lang] ?? item.status} />
        </div>
        <p className="text-sm text-ink-2">
          {item.serviceName} · <span className="nums font-semibold text-ink">{formatPrice(item.price, lang)}</span>
        </p>
        <p className="text-xs text-ink-3">
          {t("مرجع الدفع", "Payment reference")}: <span className="nums text-ink-2" dir="ltr">{item.paymentReference ?? "—"}</span> · {t("رُفع الإثبات", "Proof uploaded")} <Waiting since={item.since} lang={lang} />
        </p>
        <p className="text-[11px] leading-5 text-ink-3">{t("تأكد من وصول المبلغ فعلًا قبل التأكيد.", "Confirm only after checking the money actually arrived.")}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canConfirm ? (
            <OpsActionForm action={updateOrderStatusAction}>
              <input type="hidden" name="orderId" value={item.id} />
              <input type="hidden" name="status" value="PAID" />
              <SubmitButton size="sm">
                <CheckCircle2 size={15} aria-hidden /> {t("تأكيد الدفع", "Confirm payment")}
              </SubmitButton>
            </OpsActionForm>
          ) : null}
          {canReject ? (
            <details className="group">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger/10">
                <XCircle size={15} aria-hidden /> {t("رفض", "Reject")}
              </summary>
              <OpsActionForm action={updateOrderStatusAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="orderId" value={item.id} />
                <input type="hidden" name="status" value="REJECTED" />
                <Input name="adminNote" placeholder={t("سبب الرفض (يظهر للعميل)", "Reason (shown to the customer)")} className="h-9 min-w-48 flex-1 py-0 text-sm" maxLength={300} aria-label={t("سبب الرفض", "Reason")} />
                <SubmitButton size="sm" variant="danger">{t("تأكيد الرفض", "Confirm rejection")}</SubmitButton>
              </OpsActionForm>
            </details>
          ) : null}
          <LinkButton href={`/admin/orders/${item.id}`} size="sm" variant="ghost">{t("فتح الطلب", "Open order")}</LinkButton>
        </div>
      </div>
    </Row>
  );
}

// ------------------------------------------------------------------ orders

/** An unpaid order (no proof yet): one status change at a time, only transitions the state machine allows. */
export function OrderRow({ item, lang }: { item: OrderItem; lang: Lang }) {
  const t = translator(lang);
  // Exactly the transitions the order state machine allows from this status.
  const targets = item.transitions;

  return (
    <Row testId="ops-order">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/admin/orders/${item.id}`} className="min-w-0 font-bold text-ink hover:text-brand-ink">
          <span className="nums">{item.number}</span> · {item.customerName ?? "—"}
        </Link>
        <StatusBadge status={item.status} label={ORDER_STATUS_LABELS[item.status]?.[lang] ?? item.status} />
      </div>
      <p className="mt-1 text-xs text-ink-3">
        {REQUEST_TYPE_LABELS[item.requestType]?.[lang] ?? item.requestType} · {item.serviceName} · <span className="nums">{formatPrice(item.price, lang)}</span> · <Waiting since={item.since} lang={lang} />
      </p>
      {targets.length ? (
        <OpsActionForm action={updateOrderStatusAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="orderId" value={item.id} />
          <Select name="status" defaultValue={targets[0]} className="h-9 w-auto py-0 text-sm" aria-label={t("الحالة الجديدة", "New status")}>
            {targets.map((status) => (
              <option key={status} value={status}>{ORDER_STATUS_LABELS[status as OrderStatus][lang]}</option>
            ))}
          </Select>
          <SubmitButton size="sm" variant="secondary">{t("تحديث", "Update")}</SubmitButton>
          <LinkButton href={`/admin/orders/${item.id}`} size="sm" variant="ghost">{t("التفاصيل", "Details")}</LinkButton>
        </OpsActionForm>
      ) : null}
    </Row>
  );
}

// ------------------------------------------------------------------ activations

export function ActivationRow({ item, lang }: { item: ActivationItem; lang: Lang }) {
  const t = translator(lang);

  return (
    <Row testId="ops-activation" className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Link href={`/admin/orders/${item.id}`} className="font-bold text-ink hover:text-brand-ink">
          <span className="nums">{item.number}</span> · {item.customerName ?? "—"}
        </Link>
        <p className="mt-1 text-xs text-ink-3">
          {REQUEST_TYPE_LABELS[item.requestType]?.[lang] ?? item.requestType} · {item.serviceName} · {t("مدفوع", "paid")} <Waiting since={item.since} lang={lang} />
        </p>
      </div>
      {item.requestType === "DEVICE_PURCHASE" ? (
        <LinkButton href={`/admin/orders/${item.id}`} size="sm" variant="secondary">{t("إكمال الطلب", "Complete order")}</LinkButton>
      ) : (
        // The existing activation flow (credentials stay masked there; Phase 2 rules).
        <LinkButton href={`/admin/subscription-requests/${item.id}/add`} size="sm">
          <PackageCheck size={15} aria-hidden /> {t("تفعيل", "Activate")}
        </LinkButton>
      )}
    </Row>
  );
}

// ------------------------------------------------------------------ renewals

export function RenewalRow({ item, lang }: { item: RenewalItem; lang: Lang }) {
  const t = translator(lang);

  return (
    <Row testId="ops-renewal">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/admin/customers/${item.userId}`} className="font-bold text-ink hover:text-brand-ink">{item.customerName ?? "—"}</Link>
          <p className="mt-1 text-xs text-ink-3">
            {item.packageName} · {t("ينتهي", "ends")} <span className="nums">{formatDate(item.expiryDate, lang)}</span>
            {item.lastContactAt ? <> · {t("آخر تواصل", "last contacted")} <span className="nums">{formatDateTime(item.lastContactAt, lang)}</span></> : null}
          </p>
        </div>
        <span className="flex items-center gap-2">
          <StatusBadge status={item.state} label={SUBSCRIPTION_STATE_LABELS[item.state]?.[lang] ?? item.state} />
          <span className={cn("nums text-sm font-bold", item.daysLeft <= 0 ? "text-danger" : "text-warning")}>
            {item.daysLeft <= 0 ? t("منتهي", "ended") : t(`${item.daysLeft} يوم`, `${item.daysLeft} d`)}
          </span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.contactUrl ? (
          <LinkButton href={item.contactUrl} external size="sm" variant="secondary">
            <WhatsAppIcon size={15} /> WhatsApp
          </LinkButton>
        ) : null}
        <OpsActionForm action={logRenewalContactAction} className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="subscriptionId" value={item.id} />
          <Input name="note" placeholder={t("ملاحظة (اختياري)", "Note (optional)")} className="h-9 min-w-40 flex-1 py-0 text-sm" maxLength={200} aria-label={t("ملاحظة", "Note")} />
          <SubmitButton size="sm" variant="ghost">
            <Phone size={14} aria-hidden /> {t("تسجيل تواصل", "Log contact")}
          </SubmitButton>
        </OpsActionForm>
      </div>
    </Row>
  );
}

// ------------------------------------------------------------------ support

export function TicketRow({ item, lang, statusLabel }: { item: TicketItem; lang: Lang; statusLabel: string }) {
  const t = translator(lang);

  return (
    <Row testId="ops-ticket" className="p-0">
      <Link href={`/admin/support/${encodeURIComponent(item.id)}`} className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:bg-white/[0.03]">
        <span className="min-w-0">
          <span className="block truncate font-bold text-ink">{item.subject}</span>
          <span className="mt-1 block text-xs text-ink-3">
            {item.customerName} · <Waiting since={item.since} lang={lang} />
          </span>
        </span>
        <span className="flex items-center gap-2">
          {item.waitingOnTeam ? <span className="text-xs font-semibold text-warning">{t("بانتظار ردنا", "Needs our reply")}</span> : null}
          <StatusBadge status={item.status} label={statusLabel} />
          <ExternalLink size={14} className="text-ink-3" aria-hidden />
        </span>
      </Link>
    </Row>
  );
}

// ------------------------------------------------------------------ leads

export const LEAD_LABELS: Record<string, { ar: string; en: string }> = {
  NEW: { ar: "جديد", en: "New" },
  CONTACTED: { ar: "تم التواصل", en: "Contacted" },
  WON: { ar: "تم الاتفاق", en: "Won" },
  LOST: { ar: "لم يتم", en: "Lost" },
};

export function LeadRow({ item, lang }: { item: LeadItem; lang: Lang }) {
  const t = translator(lang);

  return (
    <Row testId="ops-lead">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink">{item.name}</p>
          <p className="mt-1 text-xs text-ink-3">
            {item.projectType} · {item.budget ?? "—"} · {item.timeline ?? "—"} · <Waiting since={item.since} lang={lang} />
          </p>
        </div>
        <StatusBadge status={item.status} label={LEAD_LABELS[item.status]?.[lang] ?? item.status} />
      </div>
      <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-ink-2">{item.details}</p>
      <OpsActionForm action={updateLeadAction} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
        <input type="hidden" name="id" value={item.id} />
        <Select name="status" defaultValue={item.status} className="h-9 w-auto py-0 text-sm" aria-label={t("الحالة", "Status")}>
          {Object.entries(LEAD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label[lang]}</option>
          ))}
        </Select>
        <Input name="adminNote" defaultValue={item.adminNote ?? ""} placeholder={t("ملاحظة داخلية", "Internal note")} className="h-9 min-w-40 flex-1 py-0 text-sm" maxLength={1000} aria-label={t("ملاحظة", "Note")} />
        <SubmitButton size="sm" variant="secondary">{t("حفظ", "Save")}</SubmitButton>
      </OpsActionForm>
    </Row>
  );
}
