"use client";

import { useState } from "react";

import { saveGroupAction } from "@/app/admin/catalogue/groups/actions";
import { ImageUploadField } from "@/app/components/admin/ImageUploadField";
import { useLanguage } from "@/app/components/LanguageProvider";
import { ActionForm } from "@/app/ui/ActionForm";
import { Button } from "@/app/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/app/ui/Field";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { DELIVERY_KINDS, PALETTE, buttonText, checkColours, type DeliveryKind } from "@/src/lib/groups";

export type GroupValues = {
  id?: number;
  name: string;
  nameEn: string | null;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  isActive: boolean;
  accent: string;
  surface: string;
  delivery: DeliveryKind;
  builtIn?: boolean;
};

const DELIVERY_LABELS: Record<DeliveryKind, [string, string]> = {
  CODE: ["كود أو بطاقة هدية", "Code or gift card"],
  ACCOUNT: ["حساب جاهز (إيميل وكلمة مرور)", "Ready account (e-mail and password)"],
  CUSTOMER_EMAIL: ["على إيميل حساب العميل", "On the customer's own account e-mail"],
};

/**
 * Create or edit a plan group, with a live preview of its section and the
 * contrast check the server repeats before saving (WCAG AA on the dark UI).
 */
export function GroupForm({ initial }: { initial: GroupValues }) {
  const { t } = useLanguage();
  const [accent, setAccent] = useState(initial.accent);
  const [surface, setSurface] = useState(initial.surface);
  const [name, setName] = useState(initial.name);
  const check = checkColours(accent, surface);
  const valid = /^#[0-9a-f]{6}$/i.test(accent) && /^#[0-9a-f]{6}$/i.test(surface);
  const id = `group-${initial.id ?? "new"}`;

  return (
    <ActionForm action={saveGroupAction} className="space-y-5" resetOnSuccess={!initial.id}>
      {initial.id ? <input type="hidden" name="groupId" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("الاسم بالعربي", "Name (Arabic)")} htmlFor={`${id}-name`} required>
          <Input id={`${id}-name`} name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="باقات Netflix" />
        </Field>
        <Field label={t("الاسم بالإنكليزي", "Name (English)")} htmlFor={`${id}-name-en`}>
          <Input id={`${id}-name-en`} name="nameEn" defaultValue={initial.nameEn ?? ""} dir="ltr" maxLength={80} placeholder="Netflix plans" />
        </Field>
        <Field label={t("الرابط المختصر", "Slug")} htmlFor={`${id}-slug`} hint={initial.builtIn ? t("مجموعة أساسية: ثابت.", "Built-in group: fixed.") : t("حروف إنكليزية صغيرة، مثال netflix", "Lowercase, e.g. netflix")} required>
          <Input id={`${id}-slug`} name="slug" defaultValue={initial.slug} dir="ltr" maxLength={40} readOnly={initial.builtIn} aria-readonly={initial.builtIn} required />
        </Field>
        <Field label={t("طريقة التسليم", "Delivery")} htmlFor={`${id}-delivery`} hint={initial.builtIn ? t("مجموعة أساسية: حسب قواعد IPTV/VIP.", "Built-in group: IPTV/VIP rules.") : undefined}>
          <Select id={`${id}-delivery`} name="delivery" defaultValue={initial.delivery} disabled={initial.builtIn}>
            {DELIVERY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(...DELIVERY_LABELS[kind])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("الوصف بالعربي", "Description (Arabic)")} htmlFor={`${id}-desc`}>
          <Textarea id={`${id}-desc`} name="description" defaultValue={initial.description ?? ""} maxLength={300} className="min-h-16" />
        </Field>
        <Field label={t("الوصف بالإنكليزي", "Description (English)")} htmlFor={`${id}-desc-en`}>
          <Textarea id={`${id}-desc-en`} name="descriptionEn" defaultValue={initial.descriptionEn ?? ""} maxLength={300} dir="ltr" className="min-h-16" />
        </Field>
        <Field label={t("الترتيب", "Order")} htmlFor={`${id}-order`} hint={t("الأصغر يظهر أول (بعد IPTV وVIP).", "Lower shows first (after IPTV and VIP).")}>
          <Input id={`${id}-order`} name="sortOrder" inputMode="numeric" dir="ltr" defaultValue={String(initial.sortOrder)} />
        </Field>
        <div className="flex items-end">
          <Checkbox name="isActive" defaultChecked={initial.isActive} label={t("ظاهرة بصفحة الباقات", "Shown on the plans page")} />
        </div>
      </div>

      <ImageUploadField name="logoUrl" defaultValue={initial.logoUrl} label={t("الشعار (اختياري)", "Logo (optional)")} endpoint="/api/admin/packages/upload" hint={t("PNG أو WEBP بخلفية شفافة أفضل.", "A transparent PNG or WEBP works best.")} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">{t("الألوان", "Colours")}</legend>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((preset) => (
            <Button
              key={preset.key}
              size="sm"
              variant="secondary"
              onClick={() => {
                setAccent(preset.accent);
                setSurface(preset.surface);
              }}
            >
              <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: preset.accent }} />
              {t(preset.ar, preset.en)}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("اللون الرئيسي", "Accent")} htmlFor={`${id}-accent`}>
            <div className="flex gap-2">
              <input type="color" aria-label={t("اختيار اللون", "Pick colour")} value={valid ? accent : "#5cc8ff"} onChange={(event) => setAccent(event.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border border-line bg-surface-2" />
              <Input id={`${id}-accent`} name="accent" value={accent} onChange={(event) => setAccent(event.target.value.trim())} dir="ltr" maxLength={7} />
            </div>
          </Field>
          <Field label={t("لون الخلفية (داكن)", "Background (dark)")} htmlFor={`${id}-surface`}>
            <div className="flex gap-2">
              <input type="color" aria-label={t("اختيار الخلفية", "Pick background")} value={valid ? surface : "#06132e"} onChange={(event) => setSurface(event.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border border-line bg-surface-2" />
              <Input id={`${id}-surface`} name="surface" value={surface} onChange={(event) => setSurface(event.target.value.trim())} dir="ltr" maxLength={7} />
            </div>
          </Field>
        </div>

        {/* Live preview: the group's colours as data, exactly as /plans draws them. */}
        {valid ? (
          <div className="rounded-3xl p-5" style={{ background: surface, boxShadow: `inset 0 0 0 1px ${accent}33` }} data-testid="group-preview">
            <p className="text-xl font-black" style={{ color: "var(--color-ink)" }} dir="auto">
              {name || t("اسم المجموعة", "Group name")}
            </p>
            <span className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ color: accent, border: `1px solid ${accent}66` }}>
              {t("خصم 20%", "20% off")}
            </span>
            <span className="ms-2 mt-2 inline-flex rounded-full px-4 py-1.5 text-sm font-bold" style={{ background: accent, color: buttonText(accent) }}>
              {t("اشترك", "Subscribe")}
            </span>
          </div>
        ) : null}

        <p className={check.ok ? "nums text-sm text-success" : "nums text-sm text-warning"} aria-live="polite" data-testid="group-contrast">
          {valid
            ? check.ok
              ? t(`التباين ممتاز: النص ${check.textOnSurface.toFixed(1)}:1، اللون ${check.accentOnSurface.toFixed(1)}:1، الزر ${check.buttonLabel.toFixed(1)}:1`, `Contrast passes: text ${check.textOnSurface.toFixed(1)}:1, accent ${check.accentOnSurface.toFixed(1)}:1, button ${check.buttonLabel.toFixed(1)}:1`)
              : t(`التباين ضعيف (اللون ${check.accentOnSurface.toFixed(1)}:1، الحد 4.5:1).`, `Contrast too low (accent ${check.accentOnSurface.toFixed(1)}:1, minimum 4.5:1).`)
            : t("الألوان بصيغة #RRGGBB.", "Colours as #RRGGBB.")}
        </p>
        {valid && !check.ok && check.suggestion ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAccent(check.suggestion!.accent);
              setSurface(check.suggestion!.surface);
            }}
            data-testid="group-suggestion"
          >
            {t(`استعمل المقترح: ${check.suggestion.accent} / ${check.suggestion.surface}`, `Use the suggestion: ${check.suggestion.accent} / ${check.suggestion.surface}`)}
          </Button>
        ) : null}
      </fieldset>

      <SubmitButton disabled={!check.ok} pendingLabel={t("جاري الحفظ...", "Saving...")}>
        {initial.id ? t("حفظ المجموعة", "Save group") : t("إضافة المجموعة", "Add group")}
      </SubmitButton>
    </ActionForm>
  );
}
