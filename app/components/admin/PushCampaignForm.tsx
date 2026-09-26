"use client";

import { Clock, Save, Send } from "lucide-react";
import { useState } from "react";

import { createPushCampaignAction } from "@/app/admin/actions";
import { ImageUploadField } from "@/app/components/admin/ImageUploadField";
import { useLanguage } from "@/app/components/LanguageProvider";
import { ActionForm } from "@/app/ui/ActionForm";
import { Field, Input, Select, Textarea } from "@/app/ui/Field";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { DESTINATION_KINDS, DESTINATION_LABELS, PERSONAL_DESTINATIONS } from "@/src/lib/destinations";
import { CAMPAIGN_AUDIENCES, CAMPAIGN_AUDIENCE_LABELS, CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from "@/src/lib/push";

type Option = { value: string; label: string };

/**
 * New mobile notification. Which fields show depends on the choices made
 * (customer phone for a single customer, a record id for specific
 * destinations, a time when scheduling); the server validates everything
 * again.
 */
export function PushCampaignForm({
  canBroadcast,
  canUploadImage,
  defaultPhone,
  announcements,
  plans,
}: {
  canBroadcast: boolean;
  canUploadImage: boolean;
  defaultPhone?: string;
  announcements: Option[];
  plans: Option[];
}) {
  const { t, language: lang } = useLanguage();
  const [audience, setAudience] = useState(canBroadcast ? "ALL" : "CUSTOMER");
  const [type, setType] = useState("ANNOUNCEMENT");
  const [destination, setDestination] = useState("NONE");
  const [mode, setMode] = useState("now");
  const label = (value: { ar: string; en: string }) => (lang === "ar" ? value.ar : value.en);
  const personal = PERSONAL_DESTINATIONS.includes(destination as (typeof PERSONAL_DESTINATIONS)[number]);
  const param = DESTINATION_LABELS[destination as keyof typeof DESTINATION_LABELS]?.param;

  return (
    <ActionForm action={createPushCampaignAction} resetOnSuccess className="mt-5 space-y-4">
      <Field label={t("العنوان", "Title")} htmlFor="title" required hint={t("يظهر عريض بإشعار الهاتف — خليه قصير وواضح.", "Shown in bold on the phone — keep it short.")}>
        <Input id="title" name="title" required maxLength={120} />
      </Field>
      <Field label={t("الرسالة", "Message")} htmlFor="body" required>
        <Textarea id="body" name="body" required rows={4} maxLength={600} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("النوع", "Type")} htmlFor="type">
          <Select id="type" name="type" value={type} onChange={(event) => setType(event.target.value)}>
            {CAMPAIGN_TYPES.map((value) => (
              <option key={value} value={value}>
                {label(CAMPAIGN_TYPE_LABELS[value])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("الفئة المستهدفة", "Audience")} htmlFor="audience">
          <Select id="audience" name="audience" value={audience} onChange={(event) => setAudience(event.target.value)}>
            {CAMPAIGN_AUDIENCES.filter((value) => canBroadcast || value === "CUSTOMER").map((value) => (
              <option key={value} value={value}>
                {label(CAMPAIGN_AUDIENCE_LABELS[value])}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {type === "OFFER" && audience !== "CUSTOMER" ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
          {t(
            "العروض توصل بس للعملاء اللي فعّلوا «العروض والخصومات» بتفضيلاتهم.",
            "Offers only reach customers who turned on “Offers & discounts” in their preferences.",
          )}
        </p>
      ) : null}

      {audience === "CUSTOMER" ? (
        <Field label={t("رقم هاتف العميل", "Customer phone")} htmlFor="phone" required>
          <Input id="phone" name="phone" required defaultValue={defaultPhone ?? ""} dir="ltr" className="text-start" />
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("الوجهة عند الضغط", "Opens when tapped")} htmlFor="destinationKind">
          <Select id="destinationKind" name="destinationKind" value={destination} onChange={(event) => setDestination(event.target.value)}>
            <option value="NONE">{t("مركز الإشعارات فقط", "Notification centre only")}</option>
            {DESTINATION_KINDS.filter((kind) => audience === "CUSTOMER" || !PERSONAL_DESTINATIONS.includes(kind)).map((kind) => (
              <option key={kind} value={kind}>
                {label(DESTINATION_LABELS[kind])}
              </option>
            ))}
          </Select>
        </Field>
        {destination === "ANNOUNCEMENT" ? (
          <Field label={t("الإعلان / العرض", "Announcement / offer")} htmlFor="destinationParam" required>
            <Select id="destinationParam" name="destinationParam" required>
              {announcements.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : destination === "PLAN" ? (
          <Field label={t("الباقة", "Plan")} htmlFor="destinationParam" required>
            <Select id="destinationParam" name="destinationParam" required>
              {plans.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : param ? (
          <Field
            label={personal && destination === "TICKET" ? t("رقم التذكرة", "Ticket id") : t("الرقم", "Id")}
            htmlFor="destinationParam"
            required
            hint={destination === "ORDER" ? t("رقم الطلب بدون SH- (مثال 123)", "Order number without SH- (e.g. 123)") : undefined}
          >
            <Input id="destinationParam" name="destinationParam" required dir="ltr" className="text-start" />
          </Field>
        ) : null}
      </div>

      {canUploadImage ? (
        <ImageUploadField name="imageUrl" label={t("صورة (اختياري — تظهر بإشعار أندرويد الموسّع)", "Image (optional — shown in expanded Android notifications)")} />
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink-2">{t("الإرسال", "Delivery")}</legend>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {[
            { value: "now", ar: "إرسال الآن", en: "Send now" },
            { value: "schedule", ar: "جدولة", en: "Schedule" },
            { value: "draft", ar: "مسودة", en: "Draft" },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 font-semibold transition ${
                mode === option.value ? "border-brand bg-brand/15 text-ink" : "border-line-strong text-ink-2"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="sr-only"
              />
              {lang === "ar" ? option.ar : option.en}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "schedule" ? (
        <Field label={t("وقت الإرسال (بتوقيت بغداد)", "Send at (Baghdad time)")} htmlFor="scheduledAt" required>
          <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
        </Field>
      ) : null}

      <SubmitButton pendingLabel={t("جاري التنفيذ...", "Working...")}>
        {mode === "now" ? <Send size={16} aria-hidden /> : mode === "schedule" ? <Clock size={16} aria-hidden /> : <Save size={16} aria-hidden />}
        {mode === "now" ? t("إرسال الآن", "Send now") : mode === "schedule" ? t("جدولة", "Schedule") : t("حفظ كمسودة", "Save draft")}
      </SubmitButton>
    </ActionForm>
  );
}
