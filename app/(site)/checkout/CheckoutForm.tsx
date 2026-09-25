"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { Check, CircleUserRound, Cpu, Info, Send, Phone } from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { ProofPicker } from "@/app/components/payment/ProofPicker";
import { TransferDetails, type TransferInfo } from "@/app/components/payment/TransferDetails";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { cn } from "@/app/ui/cn";
import { Field, Input, Textarea } from "@/app/ui/Field";
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
  transfer,
}: {
  mode: CheckoutMode;
  plans: CheckoutPlan[];
  devices: CheckoutDevice[];
  initialPlan: string | null;
  initialDevice: number | null;
  subscriptionId: number | null;
  user: { name: string; phone: string };
  contactOptions: ContactOption[];
  transfer: TransferInfo | null;
}) {
  const { t, language } = useLanguage();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, null);
  const [hasProof, setHasProof] = useState(false);
  const [proofMissing, setProofMissing] = useState(false);
  const proofRef = useRef<HTMLDivElement>(null);
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
    payment: 1 + Number(showPlan) + Number(showDevice),
    proof: 2 + Number(showPlan) + Number(showDevice),
    account: 3 + Number(showPlan) + Number(showDevice),
  };
  const canSubmit = ready && Boolean(transfer);

  // Submitted from onSubmit (not the form action) so a failed attempt keeps
  // the chosen image instead of React resetting the form.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || pending) {
      return;
    }

    if (!hasProof) {
      setProofMissing(true);
      proofRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  const proofError = proofMissing && !hasProof
    ? t("يرجى رفع صورة إثبات الدفع.", "Please upload the payment proof.")
    : state?.field === "paymentProof"
      ? state.error
      : null;

  const contactMeta: Record<ContactOption, { label: string; icon: React.ReactNode; hint: string }> = {
    TELEGRAM: { label: "Telegram", icon: <TelegramIcon size={18} />, hint: t("نراسلك على تيليجرام", "We'll message you on Telegram") },
    WHATSAPP: { label: "WhatsApp", icon: <WhatsAppIcon size={18} />, hint: t("نراسلك على واتساب", "We'll message you on WhatsApp") },
    FACEBOOK: { label: "Facebook", icon: <FacebookIcon size={18} />, hint: t("تراسلنا على ماسنجر", "You message us on Messenger") },
    PHONE: { label: t("اتصال هاتفي", "Phone call"), icon: <Phone size={18} aria-hidden />, hint: t("نتصل بيك على رقمك", "We'll call your number") },
  };

  const requestType = mode;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="requestType" value={requestType} />
      <input type="hidden" name="planSlug" value={mode === "DEVICE_PURCHASE" ? "" : planSlug ?? ""} />
      <input type="hidden" name="deviceId" value={device?.id ?? ""} />
      <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />
      <input type="hidden" name="contactMethod" value={contact} />

      <div className="space-y-6">
        {state?.error && state.field !== "paymentProof" ? <Notice tone="danger">{state.error}</Notice> : null}

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

        {/* ---------------- Payment ---------------- */}
        <section
          aria-labelledby="payment-heading"
          className="surface-raised rounded-panel border-2 border-brand/50 p-5 shadow-brand sm:p-6"
        >
          <h2 id="payment-heading" className="flex items-center gap-3 text-lg font-bold text-ink">
            <span className="nums flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {stepNumbers.payment}
            </span>
            {t("الدفع", "Payment")}
          </h2>

          {ready ? (
            <div className="mt-4">
              <p className="text-base font-bold text-ink">{t("باقتك جاهزة ✅", "Your plan is ready ✅")}</p>
              <p className="mt-1 text-[15px] leading-7 text-ink-2">
                {t(
                  "حتى نكمل طلبك، يرجى دفع قيمة الباقة ثم إرسال إثبات الدفع.",
                  "To complete your order, please pay for the plan and then send the payment proof.",
                )}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-3">
                {t(
                  "اختيار الباقة وحده ما يكمل الشراء — لازم تدفع وترسل الإثبات.",
                  "Choosing a plan alone doesn't complete the purchase — you need to pay and send the proof.",
                )}
              </p>
            </div>
          ) : (
            <Notice tone="info" className="mt-4">
              {t("اختار باقتك أولًا حتى يظهر المبلغ المطلوب.", "Choose your plan first to see the amount to pay.")}
            </Notice>
          )}

          <div className="mt-5">
            {transfer ? (
              <TransferDetails amount={ready ? total : null} info={transfer} />
            ) : (
              <Notice tone="warning">
                {t(
                  "تفاصيل الدفع غير متاحة حاليًا. تواصل ويانا حتى نكمل طلبك.",
                  "Payment details aren't available right now. Contact us to complete your order.",
                )}
              </Notice>
            )}
          </div>
        </section>

        {/* ---------------- Proof ---------------- */}
        <div ref={proofRef}>
          <Section index={stepNumbers.proof} title={t("إثبات الدفع", "Payment proof")} done={hasProof}>
            <p className="-mt-2 mb-4 text-[15px] leading-7 text-ink-2">
              {t("ارفع صورة التحويل بعد إتمام عملية الدفع.", "Upload a screenshot of the transfer once you've paid.")}
            </p>
            <ProofPicker
              error={proofError}
              onChange={(value) => {
                setHasProof(value);
                if (value) {
                  setProofMissing(false);
                }
              }}
            />
            <Field
              label={t("رقم العملية / رقم التحويل (اختياري)", "Transaction / transfer number (optional)")}
              htmlFor="paymentReference"
              hint={t("إذا يظهر رقم للعملية بإيصال التحويل، اكتبه هنا حتى نتأكد أسرع.", "If your receipt shows a transaction number, add it so we can confirm faster.")}
              className="mt-5"
            >
              <Input id="paymentReference" name="paymentReference" maxLength={120} dir="ltr" inputMode="text" autoComplete="off" className="text-start" />
            </Field>
          </Section>
        </div>

        {/* ---------------- Account & contact ---------------- */}
        <Section index={stepNumbers.account} title={t("حسابك والتواصل", "Your account & contact")} done={Boolean(contact)}>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <CircleUserRound size={22} className="shrink-0 text-brand-ink" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-bold text-ink">{user.name}</p>
              <p className="nums text-ink-3" dir="ltr">
                {user.phone}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-ink-2">
            {t(
              "إذا احتجنا نتواصل وياك بخصوص طلبك، شنو الطريقة الأنسب إلك؟",
              "If we need to reach you about your order, how should we contact you?",
            )}
          </p>
          <fieldset className="mt-3">
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
              "الاشتراك يتفعّل بعد ما يراجع فريق شاشتنا إثبات الدفع ويتأكد من وصول المبلغ.",
              "Your subscription is activated after the Shashtna team reviews the proof and confirms the payment arrived.",
            )}
          </p>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
            <SubmitButton
              size="lg"
              className="w-full"
              disabled={!canSubmit}
              pending={pending}
              pendingLabel={t("جاري إرسال الطلب...", "Sending order...")}
            >
              <Send size={16} className="rtl:-scale-x-100" aria-hidden />
              {!ready
                ? t("أكمل الاختيارات", "Complete your selection")
                : hasProof
                  ? t("أرسل الطلب وإثبات الدفع", "Send order and payment proof")
                  : t("ارفع إثبات الدفع ثم أرسل", "Upload the proof, then send")}
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
