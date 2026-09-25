"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { bulkOrderStatusAction, type AdminState } from "@/app/admin/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { StatusBadge } from "@/app/ui/Badge";
import { Select } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime, formatPrice } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, type OrderStatus } from "@/src/lib/order-status";

export type OrderRowData = {
  id: number;
  number: string;
  status: OrderStatus;
  requestType: string;
  serviceName: string;
  price: number;
  createdAt: string;
  contactMethod: string;
  customer: { id: number; name: string; phone: string } | null;
  /** The customer uploaded a transfer proof that still needs checking. */
  hasProof?: boolean;
};

const BULK_TARGETS: OrderStatus[] = ["AWAITING_PAYMENT", "PAID", "FULFILLING", "COMPLETED", "CANCELLED", "REJECTED"];

export function OrdersTable({ orders, allowBulk = true }: { orders: OrderRowData[]; allowBulk?: boolean }) {
  const { t, language } = useLanguage();
  const [selected, setSelected] = useState<number[]>([]);
  const [state, action] = useActionState<AdminState, FormData>(bulkOrderStatusAction, null);
  const allSelected = orders.length > 0 && selected.length === orders.length;

  const toggle = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <form action={action} onSubmit={() => window.setTimeout(() => setSelected([]), 0)}>
      {state ? <Notice tone={state.ok ? "success" : "danger"} className="mb-4">{state.message}</Notice> : null}

      {allowBulk ? (
        <div className="surface mb-3 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <span className="nums text-sm text-ink-2">
            {t("محدد: ", "Selected: ")}
            {selected.length}
          </span>
          <Select name="status" defaultValue="AWAITING_PAYMENT" className="h-10 w-auto py-0 text-sm" aria-label={t("الحالة الجديدة", "New status")}>
            {BULK_TARGETS.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status][language]}
              </option>
            ))}
          </Select>
          <SubmitButton size="sm" variant="secondary" disabled={!selected.length} pendingLabel={t("جاري التحديث...", "Updating...")}>
            {t("تطبيق على المحدد", "Apply to selected")}
          </SubmitButton>
          <span className="text-xs text-ink-3">{t("الانتقالات غير المسموحة يتم تخطيها.", "Transitions that aren't allowed are skipped.")}</span>
        </div>
      ) : null}

      <div className="surface overflow-x-auto rounded-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-3">
              {allowBulk ? (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : orders.map((order) => order.id))}
                    aria-label={t("تحديد الكل", "Select all")}
                    className="h-4 w-4 accent-[#2f6bff]"
                  />
                </th>
              ) : null}
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("الطلب", "Order")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("العميل", "Customer")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("النوع", "Type")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("المبلغ", "Amount")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("التاريخ", "Date")}</th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t("الحالة", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-line/70 last:border-0 hover:bg-surface-2/60">
                {allowBulk ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="ids"
                      value={order.id}
                      checked={selected.includes(order.id)}
                      onChange={() => toggle(order.id)}
                      aria-label={`${t("تحديد", "Select")} ${order.number}`}
                      className="h-4 w-4 accent-[#2f6bff]"
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-bold text-ink hover:text-brand-ink">
                    <span className="nums">{order.number}</span>
                    <span className="block max-w-56 truncate text-xs font-normal text-ink-3">{order.serviceName}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {order.customer ? (
                    <Link href={`/admin/customers/${order.customer.id}`} className="hover:text-ink">
                      <span className="block font-semibold text-ink-2">{order.customer.name}</span>
                      <span className="nums block text-xs text-ink-3" dir="ltr">{order.customer.phone}</span>
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-ink-2">{REQUEST_TYPE_LABELS[order.requestType]?.[language] ?? order.requestType}</td>
                <td className="nums px-4 py-3 font-semibold text-ink">{formatPrice(order.price, language)}</td>
                <td className="nums px-4 py-3 text-xs text-ink-3">{formatDateTime(order.createdAt, language)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status][language]} />
                  {order.hasProof ? (
                    <span className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-glow">
                      <ImageIcon size={13} aria-hidden />
                      {t("إثبات دفع مرفوع", "Proof uploaded")}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
