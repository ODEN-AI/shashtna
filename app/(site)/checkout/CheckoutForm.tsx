"use client";

import { useActionState, useState } from "react";
import { Check, CheckCircle2, CircleUserRound, Cpu, Info, Pencil, Phone } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/app/components/LanguageProvider";
import { Badge } from "@/app/ui/Badge";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { cn } from "@/app/ui/cn";
import { Field, Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatPrice } from "@/src/lib/i18n";

import { placeOrderAction, type CheckoutState } from "./actions";

export type CheckoutPlan = {
  slug: string;
  name: string;
  serviceType: "IPTV" | "VIP";
  price: number;
  durationLabel: string;
  description: string;
  features: string[];
  imageUrl: string | null;
};

export type CheckoutDevice = {
  id: number;
  name: string;
  price: number;
  description: string;
};

export type { CheckoutMode, ContactOption } from "@/src/server/checkout";
import type { CheckoutMode, ContactOption } from "@/src/server/checkout";


/**
 * Order review before the order is created: customer, the one package they
 * chose, how to reach them, a note, and the summary. Payment comes after,
 * from the account. Prices here are for display; the server recalculates
 * them from the catalogue.
 */
export function CheckoutForm({
  mode,
  plan,
  device: fixedDevice,
  devices,
  initialDevice,
  subscriptionId,
  changeHref,
  user,
  contactOptions,
  initialContact,
}: {
  mode: CheckoutMode;
  plan: CheckoutPlan | null;
  /** The device being bought (device purchases only). */
  device: CheckoutDevice | null;
  /** Devices compatible with a VIP plan; empty when no device is needed. */
  devices: CheckoutDevice[];
  initialDevice: number | null;
  subscriptionId: number | null;
  changeHref: string;
  user: { name: string; phone: string; email: string | null };
  contactOptions: ContactOption[];
  initialContact: ContactOption;
}) {
  const { t, language } = useLanguage();
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrderAction, null);
  const [deviceId, setDeviceId] = useState<number | null>(initialDevice);
  const [contact, setContact] = useState<ContactOption>(initialContact);

  const needsDevice = mode !== "DEVICE_PURCHASE" && mode !== "RENEW" && plan?.serviceType === "VIP";
  const device = fixedDevice ?? (needsDevice ? devices.find((item) => item.id === deviceId) ?? null : null);
  const total = (plan?.price ?? 0) + (device?.price ?? 0);
  const ready = mode === "DEVICE_PURCHASE" ? Boolean(fixedDevice) : Boolean(plan) && (!needsDevice || Boolean(device));

  const contactMeta: Record<ContactOption, { label: string; icon: React.ReactNode; hint: string }> = {
    TELEGRAM: { label: "Telegram", icon: <TelegramIcon size={18} />, hint: t("نراسلك على تيليجرام", "We'll message you on Telegram") },
    WHATSAPP: { label: "WhatsApp", icon: <WhatsAppIcon size={18} />, hint: t("نراسلك على واتساب", "We'll message you on WhatsApp") },
    FACEBOOK: { label: "Facebook", icon: <FacebookIcon size={18} />, hint: t("تراسلنا على ماسنجر", "You message us on Messenger") },
    PHONE: { label: t("اتصال هاتفي", "Phone call"), icon: <Phone size={18} aria-hidden />, hint: t("نتصل بيك على رقمك", "We'll call your number") },
  };

  const steps = { customer: 1, plan: 2, contact: 3, note: 4 };

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="requestType" value={mode} />
      <input type="hidden" name="planSlug" value={mode === "DEVICE_PURCHASE" ? "" : plan?.slug ?? ""} />
      <input type="hidden" name="deviceId" value={device?.id ?? ""} />
      <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />
      <input type="hidden" name="contactMethod" value={contact} />

      <div className="space-y-6">
        {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}

        {/* ---------------- Customer ---------------- */}
        <Section index={steps.customer} title={t("بيانات العميل", "Customer details")} done>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4" data-testid="checkout-customer">
            <CircleUserRound size={22} className="shrink-0 text-brand-ink" aria-hidden />
            <dl className="min-w-0 text-sm">
              <dt className="sr-only">{t("اسم العميل", "Customer name")}</dt>
              <dd className="font-bold text-ink">{user.name}</dd>
              <dt className="sr-only">{t("رقم الهاتف", "Phone")}</dt>
              <dd className="nums text-ink-3" dir="ltr">
                {user.phone}
              </dd>
              {user.email ? (
                <>
                  <dt className="sr-only">{t("البريد الإلكتروني", "Email")}</dt>
                  <dd className="truncate text-ink-3" dir="ltr">
                    {user.email}
                  </dd>
                </>
              ) : null}
            </dl>
          </div>
        </Section>

        {/* ---------------- The selected package ---------------- */}
        <Section
          index={steps.plan}
          title={mode === "DEVICE_PURCHASE" ? t("تفاصيل الجهاز", "Device details") : t("تفاصيل الباقة", "Plan details")}
          done={ready}
          action={
            <Link href={changeHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink">
              <Pencil size={13} aria-hidden />
              {t("تغيير", "Change")}
            </Link>
          }
        >
          <div className="rounded-2xl border border-brand/50 bg-brand/10 p-4 ring-1 ring-brand/30" data-testid="selected-package">
            <div className="flex items-start gap-4">
              {plan?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={plan.imageUrl} alt="" aria-hidden className="h-20 w-16 shrink-0 rounded-xl bg-black/30 object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-bold text-ink" data-testid="selected-package-name">
                    {plan ? plan.name : fixedDevice?.name}
                  </p>
                  <span className="nums text-lg font-bold text-ink">{formatPrice(plan ? plan.price : fixedDevice?.price ?? 0, language)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  {plan ? <Badge tone={plan.serviceType === "VIP" ? "glow" : "brand"}>{plan.serviceType}</Badge> : <Badge tone="glow">{t("جهاز VIP", "VIP device")}</Badge>}
                  {mode === "RENEW" ? <Badge>{t("تجديد", "Renewal")}</Badge> : mode === "UPGRADE" ? <Badge>{t("ترقية", "Upgrade")}</Badge> : null}
                  {plan ? <span>{t("المدة: ", "Duration: ")}{plan.durationLabel}</span> : null}
                </div>
                {(plan?.description || fixedDevice?.description) ? (
                  <p className="mt-2 text-sm leading-6 text-ink-2">{plan ? plan.description : fixedDevice?.description}</p>
                ) : null}
              </div>
            </div>
            {plan?.features.length ? (
              <ul className="mt-3 grid gap-1.5 border-t border-line pt-3 sm:grid-cols-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-ink-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-glow" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* VIP plans come with a compatible device. */}
          {needsDevice ? (
            <div className="mt-5">
              <p className="text-sm font-bold text-ink">{t("جهاز VIP", "VIP device")}</p>
              {devices.length ? (
                <fieldset className="mt-3">
                  <legend className="sr-only">{t("الجهاز", "Device")}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {devices.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
                          deviceId === item.id ? "border-glow/70 bg-glow/5 ring-1 ring-glow/30" : "border-line-strong bg-surface-2 hover:border-glow/40",
                        )}
                      >
                        <input type="radio" name="deviceChoice" value={item.id} checked={deviceId === item.id} onChange={() => setDeviceId(item.id)} className="sr-only" />
                        {deviceId === item.id ? <Check size={20} className="mt-0.5 shrink-0 text-glow" aria-hidden /> : <Cpu size={20} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />}
                        <span className="min-w-0">
                          <span className="block font-bold text-ink">{item.name}</span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-ink-3">{item.description}</span>
                          <span className="nums mt-2 block text-sm font-bold text-ink">+ {formatPrice(item.price, language)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <Notice tone="warning" className="mt-3">
                  {t(
                    "ماكو جهاز VIP متوافق مع هاي الباقة حاليًا. تواصل ويانا أو اختار باقة ثانية.",
                    "No compatible VIP device is available for this plan right now. Contact us or choose another plan.",
                  )}
                </Notice>
              )}
            </div>
          ) : null}
        </Section>

        {/* ---------------- Contact method ---------------- */}
        <Section index={steps.contact} title={t("طريقة التواصل", "Contact method")} done={Boolean(contact)}>
          <p className="text-sm leading-7 text-ink-2">
            {t("شلون تحب نتواصل وياك بخصوص هذا الطلب؟", "How should we contact you about this order?")}
          </p>
          <fieldset className="mt-4">
            <legend className="sr-only">{t("طريقة التواصل", "Contact method")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {contactOptions.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition",
                    contact === option ? "border-brand bg-brand/10 ring-1 ring-brand/40" : "border-line-strong bg-surface-2 hover:border-brand/50",
                  )}
                >
                  <input
                    type="radio"
                    name="contactChoice"
                    value={option}
                    checked={contact === option}
                    onChange={() => setContact(option)}
                    className="sr-only"
                  />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink">{contactMeta[option].icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-ink">{contactMeta[option].label}</span>
                    <span className="block text-xs text-ink-3">{contactMeta[option].hint}</span>
                  </span>
                  {contact === option ? <Check size={18} className="shrink-0 text-glow" aria-hidden /> : null}
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        {/* ---------------- Note ---------------- */}
        <Section index={steps.note} title={t("ملاحظة للطلب", "Order note")}>
          <Field label={t("ملاحظة (اختياري)", "Note (optional)")} htmlFor="customerNote">
            <Textarea
              id="customerNote"
              name="customerNote"
              maxLength={500}
              rows={3}
              placeholder={t("مثلًا: أفضل وقت للتواصل", "e.g. the best time to reach you")}
            />
          </Field>
        </Section>
      </div>

      {/* ---------------- Summary ---------------- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface-raised rounded-panel p-6" data-testid="checkout-summary">
          <h2 className="text-base font-bold text-ink">{t("ملخص الطلب", "Order summary")}</h2>
          <dl className="mt-5 space-y-3 text-sm">
            {plan ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">
                  {mode === "RENEW" ? t("تجديد", "Renewal") : mode === "UPGRADE" ? t("ترقية إلى", "Upgrade to") : t("الباقة", "Plan")}
                </dt>
                <dd className="text-end font-semibold text-ink">
                  {plan.name}
                  <span className="block text-xs font-normal text-ink-3">{plan.durationLabel}</span>
                </dd>
              </div>
            ) : null}
            {needsDevice || fixedDevice ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("الجهاز", "Device")}</dt>
                <dd className="text-end font-semibold text-ink">{device?.name ?? "—"}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">{t("طريقة التواصل", "Contact method")}</dt>
              <dd className="text-end font-semibold text-ink" data-testid="summary-contact">
                {contactMeta[contact].label}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">{t("المبلغ", "Amount")}</dt>
              <dd className="nums text-end font-semibold text-ink">
                {plan ? formatPrice(plan.price, language) : fixedDevice ? formatPrice(fixedDevice.price, language) : "—"}
                {plan && device ? <span className="block text-xs font-normal text-ink-3">+ {formatPrice(device.price, language)}</span> : null}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
              <dt className="font-bold text-ink">{t("الإجمالي", "Total")}</dt>
              <dd className="nums font-bold text-ink" data-testid="checkout-total">
                {ready ? formatPrice(total, language) : "—"}
              </dd>
            </div>
          </dl>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-surface-3 p-3 text-sm leading-6 text-ink-2" data-testid="checkout-next-step">
            <Info size={16} className="mt-1 shrink-0 text-info" aria-hidden />
            {t(
              "بعد تأكيد الطلب، ستنتقل إلى حسابك لإكمال الدفع وإرسال إثبات الدفع.",
              "After you confirm, you'll go to your account to pay and send the payment proof.",
            )}
          </p>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
            <SubmitButton size="lg" className="w-full" disabled={!ready} pendingLabel={t("جاري تأكيد الطلب...", "Confirming...")}>
              <CheckCircle2 size={17} aria-hidden />
              {ready ? t("تأكيد الطلب", "Confirm order") : t("اختار الجهاز أولًا", "Choose a device first")}
            </SubmitButton>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({
  index,
  title,
  done,
  action,
  children,
}: {
  index: number;
  title: string;
  done?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface rounded-panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-base font-bold text-ink">
          <span
            className={cn(
              "nums flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              done ? "bg-brand text-white" : "border border-line-strong text-ink-3",
            )}
          >
            {done ? <Check size={14} aria-hidden /> : index}
          </span>
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
