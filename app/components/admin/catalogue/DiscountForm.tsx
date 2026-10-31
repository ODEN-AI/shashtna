"use client";

import { useState } from "react";

import { endDiscountAction, saveDiscountAction } from "@/app/admin/catalogue/discounts/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { ActionForm } from "@/app/ui/ActionForm";
import { Checkbox, Field, Input, Select } from "@/app/ui/Field";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { previewPrice, toBaghdadLocal, type DiscountRule } from "@/src/lib/discounts";
import { formatPrice } from "@/src/lib/i18n";

/**
 * Add or edit the discount of one package length, with a live preview of the
 * new price. Every value is validated again on the server (overlaps included).
 */
export function DiscountForm({
  packageId,
  option,
  discount,
}: {
  packageId: number;
  option: { id: number; durationLabel: string; price: number; renewalPrice: number | null };
  discount: DiscountRule | null;
}) {
  const { t, language } = useLanguage();
  const [kind, setKind] = useState<string>(discount?.kind ?? "PERCENT");
  const [value, setValue] = useState(discount ? String(discount.value) : "");
  const [renewals, setRenewals] = useState(discount?.appliesToRenewals ?? false);
  const preview = previewPrice(option.price, kind, value);
  const renewalBase = option.renewalPrice ?? option.price;
  const renewalPreview = renewals ? previewPrice(renewalBase, kind, value) : null;
  const id = `discount-${option.id}`;

  return (
    <div className="space-y-3">
      <ActionForm action={saveDiscountAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="optionId" value={option.id} />
        <input type="hidden" name="packageId" value={packageId} />
        {discount ? <input type="hidden" name="discountId" value={discount.id} /> : null}
        <Field label={t("النوع", "Type")} htmlFor={`${id}-kind`}>
          <Select id={`${id}-kind`} name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="PERCENT">{t("نسبة %", "Percentage %")}</option>
            <option value="AMOUNT">{t("مبلغ (د.ع)", "Amount (IQD)")}</option>
          </Select>
        </Field>
        <Field label={kind === "PERCENT" ? t("النسبة (1–90)", "Percent (1–90)") : t("المبلغ بالدينار", "Amount (IQD)")} htmlFor={`${id}-value`} required>
          <Input id={`${id}-value`} name="value" inputMode="numeric" dir="ltr" value={value} onChange={(event) => setValue(event.target.value)} required />
        </Field>
        <Field label={t("يبدأ (اختياري)", "Starts (optional)")} htmlFor={`${id}-starts`} hint={t("فارغ = من هسه. بتوقيت بغداد.", "Empty = now. Baghdad time.")}>
          <Input id={`${id}-starts`} name="startsAt" type="datetime-local" dir="ltr" defaultValue={toBaghdadLocal(discount?.startsAt ?? null)} />
        </Field>
        <Field label={t("ينتهي (اختياري)", "Ends (optional)")} htmlFor={`${id}-ends`} hint={t("فارغ = لحد ما توقفه.", "Empty = until you end it.")}>
          <Input id={`${id}-ends`} name="endsAt" type="datetime-local" dir="ltr" defaultValue={toBaghdadLocal(discount?.endsAt ?? null)} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox name="appliesToRenewals" checked={renewals} onChange={(event) => setRenewals(event.target.checked)} label={t("يشمل التجديد أيضًا", "Applies to renewals too")} />
        </div>
        <p className="nums text-sm sm:col-span-2" aria-live="polite" data-testid="discount-preview">
          {preview !== null ? (
            <>
              <span className="text-ink-3 line-through">{formatPrice(option.price, language)}</span>
              <span className="mx-2 font-bold text-success">{formatPrice(preview, language)}</span>
              {renewalPreview !== null ? <span className="text-ink-2">{t(`· التجديد ${formatPrice(renewalPreview, language)}`, `· renewal ${formatPrice(renewalPreview, language)}`)}</span> : null}
            </>
          ) : (
            <span className="text-ink-3">{t("اكتب قيمة صحيحة حتى يبين السعر الجديد.", "Enter a valid value to see the new price.")}</span>
          )}
        </p>
        <div className="sm:col-span-2">
          <SubmitButton size="sm" pendingLabel={t("جاري الحفظ...", "Saving...")}>{discount ? t("حفظ التعديل", "Save changes") : t("إضافة الخصم", "Add discount")}</SubmitButton>
        </div>
      </ActionForm>
      {discount ? (
        <ActionForm action={endDiscountAction}>
          <input type="hidden" name="discountId" value={discount.id} />
          <input type="hidden" name="packageId" value={packageId} />
          <SubmitButton size="sm" variant="ghost" pendingLabel={t("جاري...", "Working...")}>
            {t("إنهاء الخصم الآن", "End discount now")}
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
