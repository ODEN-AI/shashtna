import type { Metadata } from "next";

import { BarChart } from "@/app/components/admin/BarChart";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Card, CardHeader, Stat } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { formatPrice, localeOf, toDate } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإيرادات" };

export default async function RevenuePage() {
  const { allowed } = await requireStaffPage("/admin/revenue", "insights");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const receipts = await db.orm.public.Receipt.select("price", "createdAt", "serviceType").all();
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat(localeOf(lang), { month: "short" }).format(date),
      full: new Intl.DateTimeFormat(localeOf(lang), { month: "long", year: "numeric" }).format(date),
      value: 0,
      count: 0,
    };
  });
  const byType = new Map<string, number>();

  for (const receipt of receipts) {
    const date = toDate(String(receipt.createdAt));

    if (!date) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = months.find((item) => item.key === key);

    if (month) {
      month.value += receipt.price;
      month.count += 1;
      byType.set(receipt.serviceType, (byType.get(receipt.serviceType) ?? 0) + receipt.price);
    }
  }

  const total = months.reduce((sum, month) => sum + month.value, 0);
  const current = months[months.length - 1];
  const previous = months[months.length - 2];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الإيرادات", "Revenue")}
        description={t(
          "محسوبة من الإيصالات الصادرة عند التفعيل والتجديد (آخر 12 شهر). المصاريف غير مسجلة بالنظام فلا تُعرض أرباح.",
          "Calculated from receipts issued at activation and renewal (last 12 months). Expenses aren't recorded, so no profit figure is shown.",
        )}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("هذا الشهر", "This month")} value={formatPrice(current.value, lang)} hint={t(`${current.count} إيصال`, `${current.count} receipts`)} />
        <Stat label={t("الشهر الماضي", "Last month")} value={formatPrice(previous.value, lang)} hint={t(`${previous.count} إيصال`, `${previous.count} receipts`)} />
        <Stat label={t("آخر 12 شهر", "Last 12 months")} value={formatPrice(total, lang)} />
      </div>
      <Card className="p-6">
        <CardHeader title={t("الإيرادات الشهرية", "Monthly revenue")} description={t("مرّر على العمود لعرض القيمة.", "Hover a bar to see its value.")} />
        <div className="mt-10">
          <BarChart data={months} formatValue={(value) => formatPrice(value, lang)} label={t("الإيرادات الشهرية", "Monthly revenue")} />
        </div>
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold text-brand-ink">{t("عرض كجدول", "View as table")}</summary>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th scope="col" className="py-2 text-start font-semibold">{t("الشهر", "Month")}</th>
                <th scope="col" className="py-2 text-start font-semibold">{t("الإيصالات", "Receipts")}</th>
                <th scope="col" className="py-2 text-start font-semibold">{t("المبلغ", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((month) => (
                <tr key={month.key} className="border-b border-line/60">
                  <td className="py-2 text-ink-2">{month.full}</td>
                  <td className="nums py-2 text-ink-2">{month.count}</td>
                  <td className="nums py-2 font-semibold text-ink">{formatPrice(month.value, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>
      <Card className="p-6">
        <CardHeader title={t("حسب نوع الخدمة (آخر 12 شهر)", "By service type (last 12 months)")} />
        <ul className="mt-4 divide-y divide-line">
          {[...byType.entries()].map(([type, value]) => (
            <li key={type} className="flex justify-between py-3 text-sm">
              <span className="text-ink-2">{type}</span>
              <span className="nums font-bold text-ink">{formatPrice(value, lang)}</span>
            </li>
          ))}
          {!byType.size ? <li className="py-3 text-sm text-ink-3">{t("ماكو إيصالات بهذه الفترة.", "No receipts in this period.")}</li> : null}
        </ul>
      </Card>
    </div>
  );
}
