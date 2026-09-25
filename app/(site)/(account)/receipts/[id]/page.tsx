import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { LogoMark } from "@/app/ui/Logo";
import { PrintButton } from "@/app/ui/PrintButton";
import { formatDateTime, formatPrice } from "@/src/lib/i18n";
import { formatOrderNumber } from "@/src/lib/order-status";
import { db } from "@/src/prisma/db";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إيصال" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCustomer(`/receipts/${id}`);
  const receiptId = Number(id);
  const receipt = Number.isInteger(receiptId)
    ? await db.orm.public.Receipt.first({ id: receiptId, userId: user.id })
    : null;

  if (!receipt) {
    notFound();
  }

  const { t, lang } = await getI18n();

  const rows = [
    { label: t("رقم الإيصال", "Receipt number"), value: <span className="nums" dir="ltr">{receipt.receiptNumber}</span> },
    { label: t("التاريخ", "Date"), value: <span className="nums">{formatDateTime(receipt.createdAt, lang)}</span> },
    { label: t("العميل", "Customer"), value: user.name },
    { label: t("الهاتف", "Phone"), value: <span className="nums" dir="ltr">{user.phone}</span> },
    { label: t("الخدمة", "Service"), value: `${receipt.serviceName} (${receipt.serviceType})` },
    { label: t("المدة", "Duration"), value: receipt.durationLabel },
    receipt.bonusYears > 0 ? { label: t("مدة إضافية", "Bonus"), value: `${receipt.bonusYears} ${t("سنة", "year(s)")}` } : null,
    receipt.orderId ? { label: t("رقم الطلب", "Order"), value: <span className="nums">{formatOrderNumber(receipt.orderId)}</span> } : null,
    { label: t("الحالة", "Status"), value: receipt.status === "PAID" ? t("مدفوع", "Paid") : receipt.status },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <LinkButton href="/orders?tab=receipts" variant="ghost" size="sm" className="-ms-3">
          <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
          {t("الإيصالات", "Receipts")}
        </LinkButton>
        <PrintButton label={t("طباعة", "Print")} />
      </div>

      <article className="surface-raised mx-auto max-w-2xl rounded-panel p-6 sm:p-10 print:border-0 print:bg-white print:text-black print:shadow-none">
        <header className="flex items-center justify-between gap-4 border-b border-line pb-6">
          <div className="flex items-center gap-3">
            <LogoMark className="h-11 w-11" />
            <div>
              <p className="text-lg font-bold text-ink print:text-black">{t("شاشتنا", "Shashtna")}</p>
              <p className="text-xs text-ink-3">{t("إيصال دفع", "Payment receipt")}</p>
            </div>
          </div>
          <p className="nums text-3xl font-bold text-ink print:text-black">{formatPrice(receipt.price, lang)}</p>
        </header>
        <dl className="mt-6 divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-3 text-sm">
              <dt className="text-ink-3">{row.label}</dt>
              <dd className="text-end font-semibold text-ink print:text-black">{row.value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
}
