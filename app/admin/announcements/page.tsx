import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { deleteAnnouncementAction, saveAnnouncementAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ImageUploadField } from "@/app/components/admin/ImageUploadField";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { Checkbox, Field, Input, Select, Textarea } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime, toDate } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { announcementLifecycle } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإعلانات" };

function toLocalInput(value: string | null) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const { allowed } = await requireStaffPage("/admin/announcements", "content");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const items = await db.orm.public.Announcement.orderBy([(item) => item.priority.desc(), (item) => item.id.desc()]).all();
  const editing = items.find((item) => item.id === Number(edit));
  const lifecycle = {
    INACTIVE: { tone: "neutral" as const, label: t("متوقف", "Inactive") },
    SCHEDULED: { tone: "info" as const, label: t("مجدول", "Scheduled") },
    ENDED: { tone: "neutral" as const, label: t("منتهي", "Ended") },
    LIVE: { tone: "success" as const, label: t("يُعرض الآن", "Live") },
  };
  const status = (item: (typeof items)[number]) => lifecycle[announcementLifecycle(item)];

  const labels = {
    target: { ALL: t("الموقع + التطبيق", "Website + Player"), WEBSITE: t("الموقع فقط", "Website only"), PLAYER: t("Shashtna Player فقط", "Shashtna Player only") } as Record<string, string>,
    placement: { HOME_CAROUSEL: t("الصفحة الرئيسية (عرض متحرك)", "Homepage carousel"), BANNER: t("شريط إعلاني", "Banner"), DASHBOARD: t("لوحة العميل", "Customer dashboard") } as Record<string, string>,
    style: { STANDARD: t("عادي", "Standard"), HIGHLIGHT: t("مميز", "Highlight"), INFO: t("معلومة", "Info"), WARNING: t("تنبيه", "Warning") } as Record<string, string>,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الإعلانات والتنبيهات", "Ads & announcements")}
        description={t(
          "تظهر على الموقع حسب المكان المختار. الإعلانات الموجهة لـ Shashtna Player متاحة للتطبيق عبر /api/announcements?surface=PLAYER.",
          "Shown on the website by placement. Items targeted at Shashtna Player are served to the app at /api/announcements?surface=PLAYER.",
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section aria-label={t("القائمة", "List")}>
          {items.length ? (
            <ul className="space-y-3">
              {items.map((item) => {
                const itemStatus = status(item);

                return (
                  <li key={item.id} className="surface flex flex-wrap items-center gap-4 rounded-card p-4">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-14 w-24 rounded-xl border border-line object-cover" />
                    ) : (
                      <div className="h-14 w-24 rounded-xl bg-gradient-to-br from-[#12275f] to-[#070d1c]" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">{item.title}</p>
                      <p className="mt-1 flex flex-wrap gap-2 text-xs text-ink-3">
                        <Badge tone={itemStatus.tone}>{itemStatus.label}</Badge>
                        <span>{labels.placement[item.placement] ?? item.placement}</span>
                        <span>· {labels.target[item.target] ?? item.target}</span>
                        <span className="nums">· {t("أولوية", "priority")} {item.priority}</span>
                      </p>
                      {item.startsAt || item.endsAt ? (
                        <p className="nums mt-1 text-xs text-ink-3">
                          {item.startsAt ? formatDateTime(item.startsAt, lang) : "…"} → {item.endsAt ? formatDateTime(item.endsAt, lang) : "…"}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <LinkButton href={`/admin/announcements?edit=${item.id}`} variant="secondary" size="sm">
                        {t("تعديل", "Edit")}
                      </LinkButton>
                      <form action={deleteAnnouncementAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <SubmitButton variant="danger" size="sm">
                          <Trash2 size={14} aria-hidden />
                          <span className="sr-only">{t("حذف", "Delete")}</span>
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title={t("ماكو إعلانات بعد", "No announcements yet")}
              description={t("أضف أول إعلان من النموذج. إذا ماكو إعلانات فعّالة، القسم ما يظهر بالموقع.", "Add the first one with the form. When nothing is live, the section is hidden on the site.")}
            />
          )}
        </section>

        <Card className="h-fit p-6">
          <CardHeader
            title={editing ? t("تعديل إعلان", "Edit announcement") : t("إعلان جديد", "New announcement")}
            action={editing ? <Link href="/admin/announcements" className="text-sm font-semibold text-brand-ink">{t("جديد", "New")}</Link> : null}
          />
          <ActionForm key={editing?.id ?? "new"} action={saveAnnouncementAction} resetOnSuccess={!editing} className="mt-5 space-y-4">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <Field label={t("العنوان", "Title")} htmlFor="title" required>
              <Input id="title" name="title" required maxLength={140} defaultValue={editing?.title ?? ""} />
            </Field>
            <Field label={t("الوصف", "Description")} htmlFor="description">
              <Textarea id="description" name="description" rows={3} maxLength={400} defaultValue={editing?.description ?? ""} />
            </Field>
            <ImageUploadField name="imageUrl" defaultValue={editing?.imageUrl} label={t("الصورة (اختياري)", "Image (optional)")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("نص الزر", "Button label")} htmlFor="ctaLabel">
                <Input id="ctaLabel" name="ctaLabel" maxLength={40} defaultValue={editing?.ctaLabel ?? ""} />
              </Field>
              <Field label={t("رابط الزر", "Button link")} htmlFor="ctaUrl" hint={t("مثال: /plans أو https://…", "e.g. /plans or https://…")}>
                <Input id="ctaUrl" name="ctaUrl" maxLength={500} dir="ltr" className="text-start" defaultValue={editing?.ctaUrl ?? ""} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("النوع", "Kind")} htmlFor="kind">
                <Select id="kind" name="kind" defaultValue={editing?.kind ?? "AD"}>
                  <option value="AD">{t("إعلان", "Ad")}</option>
                  <option value="ANNOUNCEMENT">{t("تنبيه / خبر", "Announcement")}</option>
                </Select>
              </Field>
              <Field label={t("الجمهور", "Target")} htmlFor="target">
                <Select id="target" name="target" defaultValue={editing?.target ?? "ALL"}>
                  {Object.entries(labels.target).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("المكان", "Placement")} htmlFor="placement">
                <Select id="placement" name="placement" defaultValue={editing?.placement ?? "HOME_CAROUSEL"}>
                  {Object.entries(labels.placement).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("الأسلوب", "Style")} htmlFor="style">
                <Select id="style" name="style" defaultValue={editing?.style ?? "STANDARD"}>
                  {Object.entries(labels.style).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("يبدأ", "Starts")} htmlFor="startsAt">
                <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInput(editing?.startsAt ?? null)} />
              </Field>
              <Field label={t("ينتهي", "Ends")} htmlFor="endsAt">
                <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInput(editing?.endsAt ?? null)} />
              </Field>
              <Field label={t("الأولوية (الأعلى أولًا)", "Priority (higher first)")} htmlFor="priority">
                <Input id="priority" name="priority" type="number" min={-100} max={100} defaultValue={editing?.priority ?? 0} />
              </Field>
            </div>
            <Checkbox name="isActive" defaultChecked={editing ? editing.isActive : true} label={t("مفعّل", "Active")} />
            <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
