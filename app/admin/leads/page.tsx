import type { Metadata } from "next";

import { updateLeadAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { StatusBadge } from "@/app/ui/Badge";
import { Input, Select } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "طلبات الحلول الرقمية" };

export default async function LeadsPage() {
  const { allowed } = await requireStaffPage("/admin/leads", "orders");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const leads = await db.orm.public.ServiceLead.orderBy((lead) => lead.id.desc()).limit(200).all();
  const labels: Record<string, string> = { NEW: t("جديد", "New"), CONTACTED: t("تم التواصل", "Contacted"), WON: t("تم الاتفاق", "Won"), LOST: t("لم يتم", "Lost") };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("طلبات شاشتنا للحلول الرقمية", "Shashtna Digital leads")}
        description={t("طلبات المشاريع من صفحة /services/request.", "Project requests from /services/request.")}
      />
      {leads.length ? (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <li key={lead.id} className="surface rounded-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">
                    {lead.name} · <span className="nums text-sm font-normal text-ink-2" dir="ltr">{lead.phone}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-3">
                    {lead.projectType} · {lead.budget ?? "—"} · {lead.timeline ?? "—"} · <span className="nums">{formatDateTime(lead.createdAt, lang)}</span>
                  </p>
                </div>
                <StatusBadge status={lead.status} label={labels[lead.status] ?? lead.status} />
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink-2">{lead.details}</p>
              <ActionForm action={updateLeadAction} className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <input type="hidden" name="id" value={lead.id} />
                <Select name="status" defaultValue={lead.status} className="h-9 w-auto py-0 text-sm" aria-label={t("الحالة", "Status")}>
                  {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Input name="adminNote" defaultValue={lead.adminNote ?? ""} placeholder={t("ملاحظة داخلية", "Internal note")} className="h-9 min-w-48 flex-1 py-0 text-sm" aria-label={t("ملاحظة", "Note")} />
                <SubmitButton size="sm" variant="secondary">{t("حفظ", "Save")}</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("ماكو طلبات بعد", "No leads yet")} />
      )}
    </div>
  );
}
