import type { Metadata } from "next";
import Link from "next/link";

import { resolveIncidentAction, saveIncidentAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge, StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { Checkbox, Field, Input, Select, Textarea } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "حالة الخدمة" };

export default async function AdminStatusPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const { allowed } = await requireStaffPage("/admin/status", "content");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const incidents = await db.orm.public.ServiceIncident.orderBy((item) => item.id.desc()).limit(50).all();
  const editing = incidents.find((item) => item.id === Number(edit));
  const statusLabels: Record<string, string> = { DEGRADED: t("أداء متأثر", "Degraded"), OUTAGE: t("عطل", "Outage"), MAINTENANCE: t("صيانة", "Maintenance") };
  const componentLabels: Record<string, string> = { ALL: t("كل الخدمات", "All services"), IPTV: "IPTV", VIP: "VIP", PLAYER: "Shashtna Player", WEBSITE: t("الموقع", "Website") };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("حالة الخدمة", "Service status")}
        description={t("المنشور هنا يظهر بصفحة /status وبإعدادات Shashtna Player. انشر فقط مشاكل حقيقية.", "Published items appear on /status and in the Shashtna Player config. Only publish real incidents.")}
        actions={<LinkButton href="/status" variant="secondary" external>{t("عرض الصفحة العامة", "View public page")}</LinkButton>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <section>
          {incidents.length ? (
            <ul className="space-y-3">
              {incidents.map((incident) => (
                <li key={incident.id} className="surface rounded-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={incident.resolvedAt ? "OPERATIONAL" : incident.status} label={incident.resolvedAt ? t("محلولة", "Resolved") : statusLabels[incident.status]} />
                      <span className="text-xs text-ink-3">{componentLabels[incident.component]}</span>
                      {!incident.isPublished ? <Badge>{t("غير منشورة", "Unpublished")}</Badge> : null}
                    </div>
                    <span className="nums text-xs text-ink-3">{formatDateTime(incident.startsAt, lang)}</span>
                  </div>
                  <p className="mt-2 font-bold text-ink">{incident.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{incident.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <LinkButton href={`/admin/status?edit=${incident.id}`} variant="secondary" size="sm">{t("تعديل", "Edit")}</LinkButton>
                    {!incident.resolvedAt ? (
                      <form action={resolveIncidentAction}>
                        <input type="hidden" name="id" value={incident.id} />
                        <SubmitButton size="sm">{t("تعليم كمحلولة", "Mark resolved")}</SubmitButton>
                      </form>
                    ) : (
                      <span className="nums self-center text-xs text-success">{t("انحلت: ", "Resolved: ")}{formatDateTime(incident.resolvedAt, lang)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("ماكو مشاكل مسجلة", "No incidents recorded")} description={t("الصفحة العامة تعرض «ماكو مشاكل معلنة».", "The public page shows “no incidents reported”.")} />
          )}
        </section>
        <Card className="h-fit p-6">
          <CardHeader
            title={editing ? t("تعديل", "Edit incident") : t("نشر مشكلة أو صيانة", "Publish an incident or maintenance")}
            action={editing ? <Link href="/admin/status" className="text-sm font-semibold text-brand-ink">{t("جديد", "New")}</Link> : null}
          />
          <ActionForm key={editing?.id ?? "new"} action={saveIncidentAction} resetOnSuccess={!editing} className="mt-5 space-y-4">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <Field label={t("العنوان", "Title")} htmlFor="title" required>
              <Input id="title" name="title" required maxLength={140} defaultValue={editing?.title ?? ""} />
            </Field>
            <Field label={t("التفاصيل", "Details")} htmlFor="message" required>
              <Textarea id="message" name="message" required rows={4} maxLength={2000} defaultValue={editing?.message ?? ""} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("النوع", "Type")} htmlFor="status">
                <Select id="status" name="status" defaultValue={editing?.status ?? "DEGRADED"}>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label={t("الخدمة", "Service")} htmlFor="component">
                <Select id="component" name="component" defaultValue={editing?.component ?? "ALL"}>
                  {Object.entries(componentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label={t("البداية (للصيانة المجدولة)", "Start (for scheduled maintenance)")} htmlFor="startsAt">
              <Input id="startsAt" name="startsAt" type="datetime-local" />
            </Field>
            <Checkbox name="isPublished" defaultChecked={editing ? editing.isPublished : true} label={t("منشورة للعملاء", "Published to customers")} />
            <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
