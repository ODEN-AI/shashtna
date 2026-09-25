import type { Metadata } from "next";
import { Download } from "lucide-react";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { Card } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التقارير" };

export default async function ReportsPage() {
  const { allowed } = await requireStaffPage("/admin/reports", "insights");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t } = await getI18n();
  const reports = [
    { type: "customers", title: t("العملاء", "Customers"), body: t("الاسم، الهاتف، الدور، التفضيلات وتاريخ الانضمام.", "Name, phone, role, preferences and join date.") },
    { type: "orders", title: t("الطلبات", "Orders"), body: t("كل الطلبات مع الحالة والمبالغ وطرق التواصل والدفع.", "All orders with status, amounts, contact and payment details.") },
    { type: "subscriptions", title: t("الاشتراكات", "Subscriptions"), body: t("الباقة، الحالة والتواريخ — بدون بيانات الدخول.", "Plan, status and dates — without login credentials.") },
    { type: "receipts", title: t("الإيصالات", "Receipts"), body: t("كل الإيصالات الصادرة مع المبالغ.", "Every issued receipt with amounts.") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("التقارير", "Reports")} description={t("تصدير CSV يفتح بـExcel وGoogle Sheets. كل تصدير يسجَّل بسجل التدقيق.", "CSV exports for Excel and Google Sheets. Every export is recorded in the audit log.")} />
      <ul className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <li key={report.type}>
            <Card className="flex h-full flex-col p-6">
              <h2 className="font-bold text-ink">{report.title}</h2>
              <p className="mt-2 flex-1 text-sm text-ink-2">{report.body}</p>
              <a
                href={`/admin/reports/export?type=${report.type}`}
                className="mt-5 inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm font-semibold text-ink hover:border-brand/60"
              >
                <Download size={16} aria-hidden />
                {t("تنزيل CSV", "Download CSV")}
              </a>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
