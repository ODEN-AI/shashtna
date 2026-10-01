import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye, Globe, History, Power } from "lucide-react";

import { removeAnnouncementAction, saveAnnouncementAction, setAnnouncementActiveAction } from "@/app/admin/actions";
import { ContentActions, ContentEditor } from "@/app/components/admin/promotions/PromotionsClient";
import { LifecycleBadge, PromotionsHeader, SurfaceList, contentLabels } from "@/app/components/admin/promotions/PromotionsUI";
import { EmptyLine, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { toLocalInput } from "@/src/lib/content-console";
import { formatDateTime } from "@/src/lib/i18n";
import { mediaOf } from "@/src/lib/promotions";
import { hasPermission } from "@/src/lib/roles";
import { safeHref } from "@/src/lib/safe-href";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getContentItem, groupOf } from "@/src/server/promotions-console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "محتوى — العروض والمحتوى" };

export default async function ContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, allowed } = await requireStaffPage(`/admin/promotions/items/${id}`, "content");

  if (!allowed) return <Forbidden />;

  const itemId = Number(id);
  const data = Number.isInteger(itemId) && itemId > 0 ? await getContentItem(itemId) : null;

  if (!data) notFound();

  const { t, lang } = await getI18n();
  const labels = contentLabels(t);
  const { item, history } = data;
  const group = groupOf(item.kind);
  const media = mediaOf(item);
  const poster = safeHref(media.imageUrl);
  const cta = safeHref(item.ctaUrl);

  return (
    <div className="space-y-5" data-testid="promo-item" data-item={item.id}>
      <PromotionsHeader
        active={group}
        t={t}
        can={(permission) => hasPermission(user.role, permission)}
        title={<span className="flex flex-wrap items-center gap-2">{item.title} <LifecycleBadge lifecycle={item.lifecycle} t={t} /></span>}
        description={<span className="nums">#{item.id} · {labels.kind[item.kind] ?? item.kind} · {labels.placement[item.placement] ?? item.placement}</span>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <ContentEditor
            action={saveAnnouncementAction}
            labels={labels}
            initial={{
              id: item.id,
              kind: item.kind,
              title: item.title,
              description: item.description,
              highlight: item.highlight,
              imageUrl: item.imageUrl,
              videoUrl: item.videoUrl,
              mediaType: item.mediaType,
              ctaLabel: item.ctaLabel,
              ctaUrl: item.ctaUrl,
              target: item.target,
              placement: item.placement,
              audience: item.audience,
              style: item.style,
              priority: item.priority,
              isActive: item.isActive,
              startsAt: toLocalInput(item.startsAt),
              endsAt: toLocalInput(item.endsAt),
            }}
          />
        </div>

        <aside className="min-w-0 space-y-4">
          <SectionCard title={t("النشر", "Publishing")} icon={<Power size={14} aria-hidden />} testId="promo-status-card">
            <ContentActions id={item.id} title={item.title} isActive={item.isActive} setActive={setAnnouncementActiveAction} remove={removeAnnouncementAction} listHref={`/admin/promotions/${group}`} />
            <dl className="mt-4 space-y-1 text-xs text-ink-3">
              <div className="flex justify-between gap-2"><dt>{t("يبدأ", "Starts")}</dt><dd className="nums">{item.startsAt ? formatDateTime(item.startsAt, lang) : t("فورًا", "Right away")}</dd></div>
              <div className="flex justify-between gap-2"><dt>{t("ينتهي", "Ends")}</dt><dd className="nums">{item.endsAt ? formatDateTime(item.endsAt, lang) : t("بدون نهاية", "No end")}</dd></div>
            </dl>
          </SectionCard>

          <SectionCard title={t("أين يظهر", "Where it appears")} icon={<Globe size={14} aria-hidden />} testId="promo-where">
            <SurfaceList surfaces={item.surfaces} t={t} />
            <p className="mt-3 text-xs leading-5 text-ink-3">
              {t("الجمهور:", "Audience:")} <span className="font-semibold text-ink-2">{labels.audience[item.audience] ?? item.audience}</span> · {t("الواجهة:", "Surface:")} <span className="font-semibold text-ink-2">{labels.target[item.target] ?? item.target}</span>
            </p>
            {item.lifecycle !== "LIVE" ? <p className="mt-2 text-xs font-semibold text-warning">{t("غير معروض الآن — يظهر فقط عندما يكون منشورًا وضمن جدولته.", "Not shown right now — it appears only when published and within its schedule.")}</p> : null}
            {item.surfaces.player ? <p className="mt-2 text-xs leading-5 text-ink-3">{t("Shashtna Player يقرأ المحتوى عبر /api/announcements ولا يطبّق الجمهور.", "Shashtna Player reads it via /api/announcements and doesn't apply the audience.")}</p> : null}
          </SectionCard>

          <SectionCard title={t("معاينة", "Preview")} icon={<Eye size={14} aria-hidden />} testId="promo-preview">
            <article inert className="pointer-events-none select-none overflow-hidden rounded-2xl border border-line bg-surface/70">
              <div className="relative aspect-[16/9] bg-gradient-to-br from-navy to-canvas">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : null}
                {media.type === "VIDEO" ? <Badge tone="glow" className="absolute start-3 top-3">{t("فيديو", "Video")}</Badge> : null}
              </div>
              <div className="space-y-2 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink">{labels.kind[item.kind] ?? item.kind}</p>
                <p className="text-lg font-bold leading-7 text-ink">{item.title}</p>
                {item.highlight ? <p className="nums text-sm font-bold text-glow">{item.highlight}</p> : null}
                {item.description ? <p className="text-sm leading-6 text-ink-2">{item.description}</p> : null}
                {item.ctaLabel && cta ? <span className="inline-flex h-9 items-center rounded-xl bg-brand px-3.5 text-sm font-semibold text-white">{item.ctaLabel}</span> : null}
              </div>
            </article>
            <p className="mt-2 text-xs text-ink-3">{t("معاينة تقريبية؛ الشكل النهائي يتبع مكان العرض.", "An approximate preview; the final look follows the placement.")}</p>
          </SectionCard>

          <SectionCard title={t("سجل التعديلات", "Change history")} icon={<History size={14} aria-hidden />} testId="promo-history">
            {!history.ok ? (
              <SectionError label={t("تعذر تحميل السجل.", "Couldn't load history.")} />
            ) : history.data.length ? (
              <ol className="space-y-3">
                {history.data.map((event) => (
                  <li key={event.id} className="text-sm" data-testid="promo-history-item" data-action={event.action}>
                    <p className="leading-6 text-ink">{event.summary}</p>
                    {event.details ? <p className="break-words text-xs leading-5 text-ink-3" dir="ltr">{event.details}</p> : null}
                    <p className="nums text-xs text-ink-3">{formatDateTime(event.createdAt, lang)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyLine>{t("لا توجد تعديلات مسجلة بعد.", "No recorded changes yet.")}</EmptyLine>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
