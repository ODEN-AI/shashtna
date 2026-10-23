"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, CircleUserRound, Cpu, Info, LogIn, Pencil, Phone } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/app/components/LanguageProvider";
import { Badge, serviceTone } from "@/app/ui/Badge";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { buttonClass } from "@/app/ui/Button";
import { distinctHighlights, repeatsDuration } from "@/app/ui/catalogue-text";
import { cn } from "@/app/ui/cn";
import { Field, Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatPrice } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";

import { placeOrderAction, type CheckoutState } from "./actions";

export type CheckoutPlan = {
  slug: string;
  name: string;
  serviceType: "IPTV" | "VIP";
  price: number;
  durationMonths: number;
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

export type CheckoutMode = "NEW" | "RENEW" | "UPGRADE" | "DEVICE_PURCHASE";

export type ContactOption = "TELEGRAM" | "WHATSAPP" | "FACEBOOK" | "PHONE";

/**
 * Order review before the order is created: the one package they chose
 * (and, for VIP, the device), how to reach them, a note, and the summary
 * with the total. Payment comes after, from the account. Prices here are
 * for display; the server recalculates them from the catalogue.
 *
 * Without a session (`user` null) the same review shows, and confirming
 * goes to sign in or register and back here with the same selection
 * (including the chosen device). Contact method and note are asked after
 * sign-in so nothing typed is lost on the way.
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
  returnQuery,
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
  user: { name: string; phone: string; email: string | null } | null;
  /** The checkout query string, to come back to after signing in. */
  returnQuery: string;
  contactOptions: ContactOption[];
  initialContact: ContactOption;
}) {
  const { t, language } = useLanguage();
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrderAction, null);
  const [deviceId, setDeviceId] = useState<number | null>(initialDevice);
  const [contact, setContact] = useState<ContactOption>(initialContact);

  const isVip = plan?.serviceType === "VIP" || mode === "DEVICE_PURCHASE";
  const needsDevice = mode !== "DEVICE_PURCHASE" && mode !== "RENEW" && plan?.serviceType === "VIP";
  const device = fixedDevice ?? (needsDevice ? devices.find((item) => item.id === deviceId) ?? null : null);
  const total = (plan?.price ?? 0) + (device?.price ?? 0);
  const ready = mode === "DEVICE_PURCHASE" ? Boolean(fixedDevice) : Boolean(plan) && (!needsDevice || Boolean(device));
  const guest = !user;

  // Where sign-in returns to: this checkout with the device picked here.
  const back = new URLSearchParams(returnQuery);
  if (needsDevice && device) back.set("device", String(device.id));
  const returnTo = `/checkout?${back.toString()}`;
  const signInHref = `/login?redirect=${encodeURIComponent(returnTo)}`;
  const registerHref = `/register?redirect=${encodeURIComponent(returnTo)}`;

  const contactMeta: Record<ContactOption, { label: string; icon: React.ReactNode; hint: string }> = {
    TELEGRAM: { label: "Telegram", icon: <TelegramIcon size={18} />, hint: t("نراسلك على تيليجرام", "We'll message you on Telegram") },
    WHATSAPP: { label: "WhatsApp", icon: <WhatsAppIcon size={18} />, hint: t("نراسلك على واتساب", "We'll message you on WhatsApp") },
    FACEBOOK: { label: "Facebook", icon: <FacebookIcon size={18} />, hint: t("تراسلنا على ماسنجر", "You message us on Messenger") },
    PHONE: { label: t("اتصال هاتفي", "Phone call"), icon: <Phone size={18} aria-hidden />, hint: t("نتصل بيك على رقمك", "We'll call your number") },
  };

  // The duration is already on the card; drop catalogue lines that only repeat it.
  const description = plan ? (repeatsDuration(plan.description, plan) ? null : plan.description) : fixedDevice?.description || null;
  const features = plan ? distinctHighlights(plan, 4) : [];

  const totalText = ready ? formatPrice(total, language) : "—";
  const confirmLabel = ready ? t("تأكيد الطلب", "Confirm order") : t("اختار الجهاز أولًا", "Choose a device first");

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="requestType" value={mode} />
      <input type="hidden" name="planSlug" value={mode === "DEVICE_PURCHASE" ? "" : plan?.slug ?? ""} />
      <input type="hidden" name="deviceId" value={device?.id ?? ""} />
      <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />
      <input type="hidden" name="contactMethod" value={contact} />

      <div className="space-y-5">
        {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}

        {/* ---------------- The selected package ---------------- */}
        <Section
          title={mode === "DEVICE_PURCHASE" ? t("الجهاز", "The device") : t("باقتك", "Your plan")}
          action={
            <Link href={changeHref} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink">
              <Pencil size={14} aria-hidden />
              {t("تغيير", "Change")}
            </Link>
          }
        >
          <div
            className={cn("rounded-2xl p-5", isVip ? "bg-vip-field text-vip" : "bg-iptv text-white")}
            data-testid="selected-package"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className={cn("text-sm font-bold", isVip ? "text-vip-text" : "text-iptv-ink")}>
                  {plan ? plan.serviceType : t("جهاز VIP", "VIP device")}
                  {mode === "RENEW" ? ` · ${t("تجديد", "Renewal")}` : mode === "UPGRADE" ? ` · ${t("ترقية", "Upgrade")}` : ""}
                </p>
                <p className="mt-1 text-2xl font-black leading-tight" dir="auto" data-testid="selected-package-name">
                  {plan ? plan.name : fixedDevice?.name}
                </p>
                {plan ? (
                  <p className={cn("nums mt-1 text-sm", isVip ? "text-vip-text" : "text-iptv-ink")}>{formatDuration(plan.durationMonths, language)}</p>
                ) : null}
              </div>
              <p className="nums text-2xl font-black">{formatPrice(plan ? plan.price : fixedDevice?.price ?? 0, language)}</p>
            </div>
            {description ? (
              <p dir="auto" className={cn("mt-3 text-sm leading-6", isVip ? "text-vip-text" : "text-iptv-ink")}>{description}</p>
            ) : null}
            {features.length ? (
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm leading-6">
                    <Check size={15} className="mt-1 shrink-0" aria-hidden />
                    <span dir="auto">{feature}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* VIP plans come with a compatible device. */}
          {needsDevice ? (
            <div className="mt-6">
              <p className="text-base font-bold text-ink">{t("اختار جهاز VIP", "Pick your VIP device")}</p>
              <p className="mt-1 text-sm text-ink-3">{t("اخترنالك الأرخص، وتكدر تبدّله.", "We picked the cheapest; you can switch.")}</p>
              {devices.length ? (
                <fieldset className="mt-3">
                  <legend className="sr-only">{t("الجهاز", "Device")}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {devices.map((item) => {
                      const selected = deviceId === item.id;

                      return (
                        <label
                          key={item.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-glow",
                            selected ? "border-vip bg-vip-field" : "border-line bg-surface-2 hover:border-vip-line",
                          )}
                        >
                          <input type="radio" name="deviceChoice" value={item.id} checked={selected} onChange={() => setDeviceId(item.id)} className="sr-only" />
                          {selected ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-vip" aria-hidden /> : <Cpu size={20} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />}
                          <span className="min-w-0">
                            <span dir="auto" className={cn("block font-bold", selected ? "text-vip" : "text-ink")}>{item.name}</span>
                            <span dir="auto" className="mt-1 line-clamp-2 block text-sm leading-6 text-ink-3">{item.description}</span>
                            <span className={cn("nums mt-2 block text-base font-bold", selected ? "text-vip" : "text-ink")}>+ {formatPrice(item.price, language)}</span>
                          </span>
                        </label>
                      );
                    })}
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

        {guest ? (
          /* ---------------- Visitor: account needed to confirm ---------------- */
          <Section title={t("حسابك", "Your account")}>
            <p className="text-sm leading-7 text-ink-2">
              {t(
                "حتى نتابع طلبك ونرسلك بيانات الاشتراك، تحتاج حساب. سجّل دخولك أو أنشئ حساب بدقيقة، وترجع لهنا بنفس الاختيار.",
                "You need an account so we can follow up your order and send your subscription details. Sign in or create one in a minute and you'll come back here with the same choice.",
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={signInHref} className={buttonClass("primary", "md")}>
                <LogIn size={16} aria-hidden />
                {t("تسجيل الدخول", "Sign in")}
              </Link>
              <Link href={registerHref} className={buttonClass("secondary", "md")}>
                {t("إنشاء حساب", "Create an account")}
              </Link>
            </div>
          </Section>
        ) : (
          <>
            {/* ---------------- Contact method ---------------- */}
            <Section title={t("شلون نتواصل وياك؟", "How should we reach you?")}>
              <fieldset>
                <legend className="sr-only">{t("طريقة التواصل", "Contact method")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {contactOptions.map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-glow",
                        contact === option ? "border-brand bg-brand/10" : "border-line bg-surface-2 hover:border-line-strong",
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
                        <span className="block text-sm text-ink-3">{contactMeta[option].hint}</span>
                      </span>
                      {contact === option ? <CheckCircle2 size={18} className="shrink-0 text-brand-ink" aria-hidden /> : null}
                    </label>
                  ))}
                </div>
              </fieldset>
            </Section>

            {/* ---------------- Note ---------------- */}
            <Section title={t("ملاحظة", "Note")}>
              <Field label={t("ملاحظة للطلب (اختياري)", "Order note (optional)")} htmlFor="customerNote">
                <Textarea
                  id="customerNote"
                  name="customerNote"
                  maxLength={500}
                  rows={3}
                  placeholder={t("مثلًا: أفضل وقت للتواصل", "e.g. the best time to reach you")}
                />
              </Field>
            </Section>
          </>
        )}
      </div>

      {/* ---------------- Summary ---------------- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface-raised rounded-panel p-6" data-testid="checkout-summary">
          <h2 className="text-lg font-bold text-ink">{t("ملخص الطلب", "Order summary")}</h2>
          {user ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface-3 p-3" data-testid="checkout-customer">
              <CircleUserRound size={20} className="shrink-0 text-ink-3" aria-hidden />
              <dl className="min-w-0 text-sm">
                <dt className="sr-only">{t("اسم العميل", "Customer name")}</dt>
                <dd className="truncate font-bold text-ink">{user.name}</dd>
                <dt className="sr-only">{t("رقم الهاتف", "Phone")}</dt>
                <dd className="nums text-ink-3" dir="ltr">
                  {user.phone}
                </dd>
              </dl>
            </div>
          ) : null}
          <dl className="mt-5 space-y-3.5 text-sm">
            {plan ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">
                  {mode === "RENEW" ? t("تجديد", "Renewal") : mode === "UPGRADE" ? t("ترقية إلى", "Upgrade to") : t("الباقة", "Plan")}
                </dt>
                <dd className="text-end font-semibold text-ink">
                  {plan.name}
                  <Badge tone={serviceTone(plan.serviceType)} className="ms-2 align-middle">{plan.serviceType}</Badge>
                </dd>
              </div>
            ) : null}
            {plan ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{mode === "RENEW" ? t("مدة التجديد", "Renewal length") : t("المدة", "Duration")}</dt>
                <dd className="nums text-end font-semibold text-ink" data-testid="summary-duration" data-months={plan.durationMonths}>
                  {formatDuration(plan.durationMonths, language)}
                  <span className="block text-xs font-normal text-ink-3">
                    {mode === "RENEW"
                      ? t("تُضاف إلى تاريخ انتهاء اشتراكك بعد تأكيد الدفع", "Added to your expiry date once payment is confirmed")
                      : t("تبدأ من يوم التفعيل بعد تأكيد الدفع", "Starts on activation, after payment is confirmed")}
                  </span>
                </dd>
              </div>
            ) : null}
            {plan ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("سعر الباقة", "Plan price")}</dt>
                <dd className="nums text-end font-semibold text-ink">{formatPrice(plan.price, language)}</dd>
              </div>
            ) : null}
            {needsDevice || fixedDevice ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{device ? device.name : t("الجهاز", "Device")}</dt>
                <dd className="nums text-end font-semibold text-ink">{device ? formatPrice(device.price, language) : "—"}</dd>
              </div>
            ) : null}
            {user ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("التواصل", "Contact")}</dt>
                <dd className="text-end font-semibold text-ink" data-testid="summary-contact">
                  {contactMeta[contact].label}
                </dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-4">
              <dt className="text-base font-bold text-ink">{t("الإجمالي", "Total")}</dt>
              <dd className="nums text-2xl font-black text-ink" data-testid="checkout-total">
                {totalText}
              </dd>
            </div>
          </dl>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-surface-3 p-3 text-sm leading-6 text-ink-2" data-testid="checkout-next-step">
            <Info size={16} className="mt-1 shrink-0 text-info" aria-hidden />
            {guest
              ? t(
                  "بعد تسجيل الدخول تأكد الطلب، وبعدها يطلعلك رقم التحويل حتى تدفع وترفع صورة الإثبات.",
                  "After signing in you confirm the order, then you get the transfer number to pay and upload the proof.",
                )
              : t(
                  "بعد تأكيد الطلب يطلعلك رقم التحويل بحسابك، تدفع وترفع صورة الإثبات.",
                  "After you confirm, your account shows the transfer number; you pay and upload the proof.",
                )}
          </p>

          {/* Mobile: a fixed bar with the total and the one action. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mb-2 flex items-baseline justify-between gap-3 lg:hidden">
              <span className="text-sm text-ink-3">{t("الإجمالي", "Total")}</span>
              <span className="nums text-xl font-black text-ink">{totalText}</span>
            </div>
            {guest ? (
              <Link href={signInHref} className={buttonClass(isVip ? "vip" : "primary", "lg", "w-full")}>
                {t("سجّل دخولك وأكمل الطلب", "Sign in to confirm")}
                <ArrowLeft size={17} className="ltr:rotate-180" aria-hidden />
              </Link>
            ) : (
              <SubmitButton
                size="lg"
                variant={isVip ? "vip" : "primary"}
                className="w-full"
                disabled={!ready}
                pendingLabel={t("جاري تأكيد الطلب...", "Confirming...")}
              >
                <CheckCircle2 size={17} aria-hidden />
                {confirmLabel}
              </SubmitButton>
            )}
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="surface rounded-panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
