"use client";

import { Loader2, Power, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";

import type { AdminState } from "@/app/admin/actions";
import { AnnouncementMediaFields } from "@/app/components/admin/AnnouncementMediaFields";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Button } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Dialog } from "@/app/ui/Dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/app/ui/Field";
import { announceSessionExpired } from "@/app/ui/session-events";
import { useToast } from "@/app/ui/Toast";

/**
 * Promotions editors. Every write is one of the existing server actions in
 * app/admin/actions.ts (saveAnnouncementAction, setAnnouncementActiveAction,
 * removeAnnouncementAction) — they check the "content" permission, validate
 * on the server and write the audit log. These components only collect
 * values and show the server's answer.
 */

type Action = (state: AdminState, formData: FormData) => Promise<AdminState>;
type Options = Record<string, string>;

export type ContentValues = {
  id?: number;
  kind: string;
  title: string;
  description: string | null;
  highlight: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaType: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  target: string;
  placement: string;
  audience: string;
  style: string;
  priority: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

function Group({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line/70 bg-white/[0.02] p-4 sm:p-5" data-testid={testId}>
      <legend className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Choice({ id, name, label, value, options, hint }: { id: string; name: string; label: string; value: string; options: Options; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Select id={id} name={name} defaultValue={value}>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>{text}</option>
        ))}
      </Select>
    </Field>
  );
}

export function ContentEditor({ action, initial, labels }: { action: Action; initial: ContentValues; labels: { kind: Options; target: Options; placement: Options; audience: Options; style: Options } }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const editing = initial.id !== undefined;
  const [state, setState] = useState<AdminState>(null);
  const [pending, startTransition] = useTransition();

  // Submitted by hand (not <form action>): a form action resets the fields
  // afterwards, which would throw away the input when the server rejects it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => setState(await action(null, formData)));
  }

  useEffect(() => {
    if (state?.code === "UNAUTHENTICATED") announceSessionExpired();
    if (!state?.ok) return;
    toast(state.message);
    if (editing) router.refresh();
    else if (state.id) router.push(`/admin/promotions/items/${state.id}`);
  }, [state, toast, router, editing]);

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="promo-form">
      {editing ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Group title={t("المحتوى", "Content")}>
        <Field label={t("العنوان", "Title")} htmlFor="promo-title" required>
          <Input id="promo-title" name="title" maxLength={140} defaultValue={initial.title} />
        </Field>
        <Field label={t("الوصف", "Description")} htmlFor="promo-description" hint={t("سطر أو سطرين. لوحة العروض تعرض أول ~140 حرف.", "One or two lines. The hero board shows about 140 characters.")}>
          <Textarea id="promo-description" name="description" rows={3} maxLength={400} defaultValue={initial.description ?? ""} />
        </Field>
        <Field label={t("سطر مميز (اختياري)", "Highlight line (optional)")} htmlFor="promo-highlight" hint={t("سعر أو معلومة قصيرة حقيقية.", "A real price or short fact.")}>
          <Input id="promo-highlight" name="highlight" maxLength={60} defaultValue={initial.highlight ?? ""} />
        </Field>
      </Group>

      <Group title={t("الوسائط", "Media")} testId="promo-media">
        <AnnouncementMediaFields mediaType={initial.mediaType} imageUrl={initial.imageUrl} videoUrl={initial.videoUrl} />
      </Group>

      <Group title={t("زر الإجراء", "Call to action")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("نص الزر", "Button label")} htmlFor="promo-cta-label">
            <Input id="promo-cta-label" name="ctaLabel" maxLength={40} defaultValue={initial.ctaLabel ?? ""} />
          </Field>
          <Field label={t("رابط الزر", "Button link")} htmlFor="promo-cta-url" hint={t("مسار بالموقع مثل /plans أو رابط https://", "A site path like /plans or an https:// link")}>
            <Input id="promo-cta-url" name="ctaUrl" maxLength={500} dir="ltr" className="text-start" defaultValue={initial.ctaUrl ?? ""} />
          </Field>
        </div>
      </Group>

      <Group title={t("المكان والجمهور", "Placement & audience")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice id="promo-kind" name="kind" label={t("النوع", "Kind")} value={initial.kind} options={labels.kind} />
          <Choice id="promo-placement" name="placement" label={t("المكان", "Placement")} value={initial.placement} options={labels.placement} />
          <Choice id="promo-target" name="target" label={t("الواجهة", "Surface")} value={initial.target} options={labels.target} hint={t("أماكن الموقع الجديدة (اللوحة، شاشة الدخول، آخر الإعلانات) للموقع فقط دائمًا.", "The website placements (board, entry screen, latest) are always website-only.")} />
          <Choice id="promo-audience" name="audience" label={t("الجمهور", "Audience")} value={initial.audience} options={labels.audience} />
          <Choice id="promo-style" name="style" label={t("الأسلوب", "Style")} value={initial.style} options={labels.style} />
          <Field label={t("الأولوية (الأعلى أولًا)", "Priority (higher first)")} htmlFor="promo-priority" hint={t("رقم صحيح من ‎-100 إلى 100.", "A whole number from −100 to 100.")}>
            <Input id="promo-priority" name="priority" inputMode="numeric" dir="ltr" defaultValue={initial.priority} />
          </Field>
        </div>
      </Group>

      <Group title={t("النشر والجدولة", "Publishing & schedule")} testId="promo-schedule">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("يبدأ", "Starts")} htmlFor="promo-starts" hint={t("فارغ = فورًا.", "Empty = right away.")}>
            <Input id="promo-starts" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} />
          </Field>
          <Field label={t("ينتهي", "Ends")} htmlFor="promo-ends" hint={t("فارغ = بدون نهاية.", "Empty = no end.")}>
            <Input id="promo-ends" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} />
          </Field>
        </div>
        <Checkbox name="isActive" defaultChecked={initial.isActive} label={t("منشور — يظهر ضمن جدولته", "Published — shown within its schedule")} />
      </Group>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur md:bottom-4">
        <p className={cn("min-w-0 flex-1 text-sm", state && !state.ok ? "font-semibold text-danger" : "text-ink-3")} role={state && !state.ok ? "alert" : undefined} data-testid="promo-form-error">
          {state && !state.ok ? state.message : ""}
        </p>
        <Button type="submit" disabled={pending} data-testid="promo-save">
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
          {editing ? t("حفظ التعديلات", "Save changes") : t("إنشاء", "Create")}
        </Button>
      </div>
    </form>
  );
}

/** Publish / unpublish (the safe way to take content down) and delete, both confirmed. */
export function ContentActions({ id, title, isActive, setActive, remove, listHref }: { id: number; title: string; isActive: boolean; setActive: Action; remove: Action; listHref: string }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState<"" | "status" | "delete">("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(kind: "status" | "delete") {
    const form = new FormData();
    form.set("id", String(id));
    if (kind === "status") form.set("isActive", String(!isActive));

    startTransition(async () => {
      const result = await (kind === "status" ? setActive : remove)(null, form);

      if (result?.code === "UNAUTHENTICATED") announceSessionExpired();
      if (!result?.ok) {
        setError(result?.message ?? t("تعذر تنفيذ الإجراء.", "Couldn't complete the action."));
        return;
      }

      toast(result.message);
      setConfirm("");
      setError("");
      if (kind === "delete") router.push(listHref);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3" data-testid="promo-actions">
      <div className="flex flex-wrap gap-2">
        <Button variant={isActive ? "secondary" : "primary"} size="sm" onClick={() => setConfirm("status")} data-testid="promo-toggle">
          <Power size={15} aria-hidden />
          {isActive ? t("إيقاف النشر", "Unpublish") : t("نشر", "Publish")}
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirm("delete")} data-testid="promo-delete">
          <Trash2 size={15} aria-hidden />
          {t("حذف", "Delete")}
        </Button>
      </div>
      <p className="text-xs leading-5 text-ink-3">{t("الإيقاف يخفيه من كل الواجهات ويحفظه للرجوع إليه. الحذف نهائي.", "Unpublishing hides it everywhere and keeps it. Deleting is permanent.")}</p>
      {error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}

      <Dialog
        open={confirm === "status"}
        onClose={() => setConfirm("")}
        title={isActive ? t(`إيقاف نشر «${title}»؟`, `Unpublish “${title}”?`) : t(`نشر «${title}»؟`, `Publish “${title}”?`)}
        description={isActive ? t("يختفي من الموقع والتطبيق فورًا.", "It disappears from the website and the app right away.") : t("يظهر للجمهور المحدد ضمن جدولته.", "It appears to its audience within its schedule.")}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm("")}>{t("إلغاء", "Cancel")}</Button>
            <Button onClick={() => run("status")} disabled={pending} data-testid="promo-toggle-confirm">
              {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
              {isActive ? t("إيقاف النشر", "Unpublish") : t("نشر", "Publish")}
            </Button>
          </div>
        }
      />
      <Dialog
        open={confirm === "delete"}
        onClose={() => setConfirm("")}
        title={t(`حذف «${title}» نهائيًا؟`, `Permanently delete “${title}”?`)}
        description={t("لا يمكن التراجع. سجل التدقيق يحتفظ بأثر الحذف. إذا تريد إخفاءه فقط، استخدم «إيقاف النشر».", "This can't be undone; the audit log keeps a record. To just hide it, unpublish instead.")}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm("")}>{t("إلغاء", "Cancel")}</Button>
            <Button variant="danger" onClick={() => run("delete")} disabled={pending} data-testid="promo-delete-confirm">
              {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
              {t("حذف نهائي", "Delete permanently")}
            </Button>
          </div>
        }
      />
    </div>
  );
}
