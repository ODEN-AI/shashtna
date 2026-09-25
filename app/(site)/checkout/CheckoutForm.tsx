"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, CircleUserRound, Cpu, Info, Lock, Phone } from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { cn } from "@/app/ui/cn";
import { Field, Select, Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatPrice } from "@/src/lib/i18n";

import { placeOrderAction, type CheckoutState } from "./actions";

export type CheckoutPlan = {
  slug: string;
  id: number;
  name: string;
  serviceType: "IPTV" | "VIP";
  price: number;
  durationLabel: string;
  isPopular: boolean;
};

export type CheckoutDevice = {
  id: number;
  name: string;
  price: number;
  description: string;
  packageIds: number[];
};

export type CheckoutMode = "NEW" | "RENEW" | "UPGRADE" | "DEVICE_PURCHASE";

type ContactOption = "TELEGRAM" | "WHATSAPP" | "FACEBOOK" | "PHONE";

export function CheckoutForm({
  mode,
  plans,
  devices,
  initialPlan,
  initialDevice,
  subscriptionId,
  user,
  contactOptions,
  paymentMethods,
}: {
  mode: CheckoutMode;
  plans: CheckoutPlan[];
  devices: CheckoutDevice[];
  initialPlan: string | null;
  initialDevice: number | null;
  subscriptionId: number | null;
  user: { name: string; phone: string };
  contactOptions: ContactOption[];
  paymentMethods: string[];
}) {
  const { t, language } = useLanguage();
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrderAction, null);
  const [planSlug, setPlanSlug] = useState<string | null>(initialPlan);
  const [deviceId, setDeviceId] = useState<number | null>(initialDevice);
  const [contact, setContact] = useState<ContactOption>(contactOptions[0] ?? "PHONE");

  const plan = plans.find((item) => item.slug === planSlug) ?? null;
  const needsDevice = mode !== "RENEW" && mode !== "DEVICE_PURCHASE" && plan?.serviceType === "VIP";
  const compatibleDevices = useMemo(
    () => (plan ? devices.filter((device) => device.packageIds.includes(plan.id)) : []),
    [devices, plan],
  );
  const device =
    mode === "DEVICE_PURCHASE"
      ? devices.find((item) => item.id === deviceId) ?? null
      : needsDevice
        ? compatibleDevices.find((item) => item.id === deviceId) ?? null
        : null;

  const total = mode === "DEVICE_PURCHASE" ? device?.price ?? 0 : (plan?.price ?? 0) + (device?.price ?? 0);
  const ready = mode === "DEVICE_PURCHASE" ? Boolean(device) : Boolean(plan) && (!needsDevice || Boolean(device));

  const showPlan = mode !== "DEVICE_PURCHASE";
  const showDevice = needsDevice || mode === "DEVICE_PURCHASE";
  const stepNumbers = {
    plan: 1,
    device: showPlan ? 2 : 1,
    account: 1 + Number(showPlan) + Number(showDevice),
    contact: 2 + Number(showPlan) + Number(showDevice),
  };

  const contactMeta: Record<ContactOption, { label: string; icon: React.ReactNode; hint: string }> = {
    TELEGRAM: { label: "Telegram", icon: <TelegramIcon size={18} />, hint: t("نراسلك على تيليجرام", "We'll message you on Telegram") },
    WHATSAPP: { label: "WhatsApp", icon: <WhatsAppIcon size={18} />, hint: t("نراسلك على واتساب", "We'll message you on WhatsApp") },
    FACEBOOK: { label: "Facebook", icon: <FacebookIcon size={18} />, hint: t("تراسلنا على ماسنجر", "You message us on Messenger") },
    PHONE: { label: t("اتصال هاتفي", "Phone call"), icon: <Phone size={18} aria-hidden />, hint: t("نتصل بيك على رقمك", "We'll call your number") },
  };

  const requestType = mode;

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="requestType" value={requestType} />
      <input type="hidden" name="planSlug" value={mode === "DEVICE_PURCHASE" ? "" : planSlug ?? ""} />
      <input type="hidden" name="deviceId" value={device?.id ?? ""} />
      <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />
      <input type="hidden" name="contactMethod" value={contact} />

      <div className="space-y-6">
        {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}

        {/* ---------------- Plan ---------------- */}
        {mode !== "DEVICE_PURCHASE" ? (
          <Section
            index={stepNumbers.plan}
            title={
              mode === "RENEW"
                ? t("اختار مدة التجديد", "Choose the renewal period")
                : mode === "UPGRADE"
                  ? t("اختار الباقة الجديدة", "Choose your new plan")
                  : t("الباقة", "Plan")
            }
            done={Boolean(plan)}
          >
            {plans.length ? (
              <fieldset>
                <legend className="sr-only">{t("الباقة", "Plan")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((item) => (
                    <label
                      key={item.slug}
                      className={cn(
                        "relative flex cursor-pointer flex-col rounded-2xl border p-4 transition",
                        planSlug === item.slug
                          ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                          : "border-line-strong bg-surface-2 hover:border-brand/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="planChoice"
                        value={item.slug}
                        checked={planSlug === item.slug}
                        onChange={() => {
                          setPlanSlug(item.slug);
                          setDeviceId(null);
                        }}
                        className="sr-only"
                      />
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-bold text-ink">{item.name}</span>
                        {planSlug === item.slug ? <Check size={18} className="text-glow" aria-hidden /> : null}
                      </span>
                      <span className="mt-1 text-xs text-ink-3">
                        {item.serviceType} · {item.durationLabel}
                      </span>
                      <span className="nums mt-3 text-lg font-bold text-ink">{formatPrice(item.price, language)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <Notice tone="warning">{t("ماكو باقات متاحة لهذا الطلب حاليًا.", "No plans are available for this order right now.")}</Notice>
            )}
          </Section>
        ) : null}

        {/* ---------------- Device ---------------- */}
        {needsDevice || mode === "DEVICE_PURCHASE" ? (
          <Section index={stepNumbers.device} title={t("جهاز VIP", "VIP device")} done={Boolean(device)}>
            {(mode === "DEVICE_PURCHASE" ? devices : compatibleDevices).length ? (
              <fieldset>
                <legend className="sr-only">{t("الجهاز", "Device")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(mode === "DEVICE_PURCHASE" ? devices : compatibleDevices).map((item) => (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
                        deviceId === item.id
                          ? "border-glow/70 bg-glow/5 ring-1 ring-glow/30"
                          : "border-line-strong bg-surface-2 hover:border-glow/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="deviceChoice"
                        value={item.id}
                        checked={deviceId === item.id}
                        onChange={() => setDeviceId(item.id)}
                        className="sr-only"
                      />
                      <Cpu size={20} className="mt-0.5 shrink-0 text-glow" aria-hidden />
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
              <Notice tone="warning">
                {t(
                  "ماكو جهاز VIP متوافق مع هاي الباقة حاليًا. تواصل ويانا أو اختار باقة ثانية.",
                  "No compatible VIP device is available for this plan right now. Contact us or choose another plan.",
                )}
              </Notice>
            )}
          </Section>
        ) : null}

        {/* ---------------- Account ---------------- */}
        <Section index={stepNumbers.account} title={t("الحساب", "Account")} done>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <CircleUserRound size={22} className="shrink-0 text-brand-ink" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-bold text-ink">{user.name}</p>
              <p className="nums text-ink-3" dir="ltr">
                {user.phone}
              </p>
            </div>
          </div>
        </Section>

        {/* ---------------- Contact & payment ---------------- */}
        <Section index={stepNumbers.contact} title={t("الدفع والتواصل", "Payment & contact")} done={Boolean(contact)}>
          <p className="text-sm leading-7 text-ink-2">
            {t(
              "ماكو دفع داخل الموقع. بعد إرسال الطلب، فريقنا يتواصل وياك لترتيب الدفع. اختار الطريقة الأنسب إلك:",
              "There's no payment on the website. After you submit, our team contacts you to arrange payment. Choose how to reach you:",
            )}
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink">
                    {contactMeta[option].icon}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{contactMeta[option].label}</span>
                    <span className="block text-xs text-ink-3">{contactMeta[option].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {paymentMethods.length ? (
            <Field label={t("طريقة الدفع المفضلة", "Preferred payment method")} htmlFor="paymentMethod" className="mt-5">
              <Select id="paymentMethod" name="paymentMethod" defaultValue="">
                <option value="">{t("أقرر ويا الفريق", "Decide with the team")}</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label={t("ملاحظة (اختياري)", "Note (optional)")} htmlFor="customerNote" className="mt-5">
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
        <div className="surface-raised rounded-panel p-6">
          <h2 className="text-base font-bold text-ink">{t("ملخص الطلب", "Order summary")}</h2>
          <dl className="mt-5 space-y-3 text-sm">
            {mode !== "DEVICE_PURCHASE" ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">
                  {mode === "RENEW" ? t("تجديد", "Renewal") : mode === "UPGRADE" ? t("ترقية إلى", "Upgrade to") : t("الباقة", "Plan")}
                </dt>
                <dd className="text-end font-semibold text-ink">
                  {plan ? `${plan.name}` : "—"}
                  {plan ? <span className="block text-xs font-normal text-ink-3">{plan.durationLabel}</span> : null}
                </dd>
              </div>
            ) : null}
            {mode !== "DEVICE_PURCHASE" && plan ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("سعر الباقة", "Plan price")}</dt>
                <dd className="nums font-semibold text-ink">{formatPrice(plan.price, language)}</dd>
              </div>
            ) : null}
            {device ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{device.name}</dt>
                <dd className="nums font-semibold text-ink">{formatPrice(device.price, language)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
              <dt className="font-bold text-ink">{t("المجموع", "Total")}</dt>
              <dd className="nums font-bold text-ink">{ready ? formatPrice(total, language) : "—"}</dd>
            </div>
          </dl>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-surface-3 p-3 text-xs leading-6 text-ink-2">
            <Info size={15} className="mt-0.5 shrink-0 text-info" aria-hidden />
            {t(
              "إرسال الطلب ما يعني الدفع. الاشتراك يتفعّل بعد تأكيد الدفع ويا فريقنا.",
              "Submitting doesn't charge you. Activation follows once payment is confirmed with our team.",
            )}
          </p>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
            <SubmitButton
              size="lg"
              className="w-full"
              disabled={!ready}
              pendingLabel={t("جاري إرسال الطلب...", "Placing order...")}
            >
              <Lock size={16} aria-hidden />
              {ready ? t("تأكيد وإرسال الطلب", "Confirm and place order") : t("أكمل الاختيارات", "Complete your selection")}
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
  children,
}: {
  index: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="surface rounded-panel p-5 sm:p-6">
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
      <div className="mt-5">{children}</div>
    </section>
  );
}
