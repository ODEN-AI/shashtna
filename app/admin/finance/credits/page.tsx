import type { Metadata } from "next";
import { Coins, History } from "lucide-react";

import { addCreditPurchaseAction } from "@/app/admin/finance/credits/actions";
import { EmptyLine, SectionCard } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { Stat } from "@/app/ui/Card";
import { Field, Input } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { businessDay } from "@/src/lib/business-time";
import { centsToDollars } from "@/src/lib/costs";
import { formatDate, formatPrice } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { listCreditPurchases } from "@/src/server/costs";
import { getI18n } from "@/src/server/i18n";
import { isFullAccess } from "@/src/lib/system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "رصيد اللوحة" };

/**
 * Admin → Finance → Panel credit (owner only): every credit purchase, the
 * current rate (the latest purchase) and its history. Orders store the cost
 * at the rate in force when they complete.
 */
export default async function CreditPurchasesPage() {
  const { user, allowed } = await requireStaffPage("/admin/finance/credits", "finance");

  if (!allowed || !isFullAccess(user.role)) {
    return <Forbidden />;
  }

  const [{ t, lang }, purchases] = await Promise.all([getI18n(), listCreditPurchases()]);
  const current = purchases[0] ?? null;
  const rate = (value: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${t("د.ع للدولار", "IQD per $")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("رصيد اللوحة", "Panel credit")}
        description={t(
          "سجّل كل شروة رصيد للوحة التفعيل. آخر شروة تحدد سعر الدولار، وكل طلب يكتمل ينحفظ عليه كلفته بهذا السعر. الشروات القديمة ما تتغير.",
          "Record every panel credit purchase. The latest sets the dollar rate, and each order stores its cost at that rate when it completes. Past purchases never change.",
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label={t("السعر الحالي", "Current rate")} value={current ? rate(current.rate) : "—"} hint={current ? `${t("من شروة", "From the purchase of")} ${formatDate(current.purchasedOn, lang)}` : t("ماكو شروة مسجّلة بعد", "No purchase recorded yet")} />
        <Stat label={t("الشروات المسجّلة", "Purchases recorded")} value={purchases.length} />
      </div>

      {!current ? (
        <Notice tone="warning" title={t("الكلفة غير معروفة", "Cost unknown")}>
          {t("بدون شروة رصيد مسجّلة، كل طلب يكتمل تنكتب كلفته «غير معروفة».", "Without a recorded purchase, every completed order's cost is «unknown».")}
        </Notice>
      ) : null}

      <SectionCard title={t("تسجيل شروة رصيد", "Record a purchase")} icon={<Coins size={14} aria-hidden />} testId="credit-form">
        <ActionForm action={addCreditPurchaseAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
          <Field label={t("تاريخ الشراء", "Purchase date")} htmlFor="purchasedOn" required>
            <Input id="purchasedOn" name="purchasedOn" type="date" dir="ltr" defaultValue={businessDay(new Date())} required />
          </Field>
          <Field label={t("الرصيد بالدولار", "Credit (USD)")} htmlFor="creditUsd" hint={t("مثال: 200 أو 12.50", "e.g. 200 or 12.50")} required>
            <Input id="creditUsd" name="creditUsd" inputMode="decimal" dir="ltr" required />
          </Field>
          <Field label={t("المدفوع بالدينار", "Paid (IQD)")} htmlFor="iqdPaid" hint={t("مثال: 180000", "e.g. 180000")} required>
            <Input id="iqdPaid" name="iqdPaid" inputMode="numeric" dir="ltr" required />
          </Field>
          <Field label={t("ملاحظة (اختياري)", "Note (optional)")} htmlFor="note">
            <Input id="note" name="note" maxLength={300} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
          </div>
        </ActionForm>
      </SectionCard>

      <SectionCard title={t("سجل الأسعار", "Rate history")} icon={<History size={14} aria-hidden />} testId="credit-history">
        {purchases.length ? (
          <ul className="divide-y divide-line/70">
            {purchases.map((purchase, index) => (
              <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" data-testid="credit-row">
                <span className="min-w-0">
                  <span className="nums block font-semibold text-ink">
                    ${centsToDollars(purchase.creditCents)} → {formatPrice(purchase.iqdPaid, lang)}
                    {index === 0 ? (
                      <Badge tone="success" className="ms-2">
                        {t("الحالي", "Current")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="nums block text-xs text-ink-3">
                    {formatDate(purchase.purchasedOn, lang)}
                    {purchase.note ? ` · ${purchase.note}` : ""}
                  </span>
                </span>
                <span className="nums font-bold text-ink">{rate(purchase.rate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>{t("ماكو شروات مسجّلة.", "No purchases recorded.")}</EmptyLine>
        )}
      </SectionCard>
    </div>
  );
}
