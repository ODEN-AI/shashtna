"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, CircleUserRound, Cpu, Info, LogIn, Pencil, Phone } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/app/components/LanguageProvider";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { distinctHighlights, repeatsDuration } from "@/app/ui/catalogue-text";
import { cn } from "@/app/ui/cn";
import { Field, Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatPrice } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";

import { placeOrderAction, type CheckoutState } from "./actions";
import c from "./checkout.module.css";

// Pictures when the catalogue item has none of its own.
const VIP_ART = "/brand/vip-art.jpg";
const MARK = "/brand/shashtna-mark-256.webp";

export type CheckoutPlan = {
  slug: string;
  /** The package option (length + price) being ordered. */
  optionId: number | null;
  name: string;
  serviceType: "IPTV" | "VIP";
  price: number;
  durationMonths: number;
  durationLabel: string;
  description: string;
  features: string[];
  imageUrl: string | null;
  /** Every length the plan is sold in, with what this order would cost in it. */
  options: { id: number; durationMonths: number; price: number }[];
  /** Loyalty points this order earns (IPTV, program on); null hides the line. */
  points?: number | null;
};

export type CheckoutDevice = {
  id: number;
  name: string;
  price: number;
  description: string;
  imageUrl: string | null;
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
    TELEGRAM: { label: "Telegram", icon: <TelegramIcon size={20} />, hint: t("نراسلك على تيليجرام", "We'll message you on Telegram") },
    WHATSAPP: { label: "WhatsApp", icon: <WhatsAppIcon size={20} />, hint: t("نراسلك على واتساب", "We'll message you on WhatsApp") },
    FACEBOOK: { label: "Facebook", icon: <FacebookIcon size={20} />, hint: t("تراسلنا على ماسنجر", "You message us on Messenger") },
    PHONE: { label: t("اتصال هاتفي", "Phone call"), icon: <Phone size={20} aria-hidden />, hint: t("نتصل بيك على رقمك", "We'll call your number") },
  };

  // The duration is already on the card; drop catalogue lines that only repeat it.
  const description = plan ? (repeatsDuration(plan.description, plan) ? null : plan.description) : fixedDevice?.description || null;
  const features = plan ? distinctHighlights(plan, 4) : [];
  const art = plan?.imageUrl ?? fixedDevice?.imageUrl ?? (isVip ? VIP_ART : null);

  const totalText = ready ? formatPrice(total, language) : "—";
  const confirmLabel = ready ? t("تأكيد الطلب", "Confirm order") : t("اختار الجهاز أولًا", "Choose a device first");
  const actionClass = cn(c.btn, c.btnFull, isVip ? c.btnGold : c.btnPrimary);

  return (
    <form action={action} className={c.form}>
      <input type="hidden" name="requestType" value={mode} />
      <input type="hidden" name="planSlug" value={mode === "DEVICE_PURCHASE" ? "" : plan?.slug ?? ""} />
      {/* The server checks this length belongs to the plan and prices the order from it. */}
      <input type="hidden" name="optionId" value={mode === "DEVICE_PURCHASE" ? "" : plan?.optionId ?? ""} />
      <input type="hidden" name="deviceId" value={device?.id ?? ""} />
      <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />
      <input type="hidden" name="contactMethod" value={contact} />

      <div className={c.main}>
        {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}

        {/* ---------------- The selected package ---------------- */}
        <Section
          title={mode === "DEVICE_PURCHASE" ? t("الجهاز", "The device") : t("باقتك", "Your plan")}
          action={
            <Link href={changeHref} className={c.change}>
              <Pencil size={14} aria-hidden />
              {t("تغيير", "Change")}
            </Link>
          }
        >
          <div className={cn(c.product, isVip ? c.productVip : c.productIptv)} data-testid="selected-package">
            <span className={c.productArt}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art ?? MARK} alt="" className={art ? undefined : c.mark} />
            </span>
            <div className="min-w-0">
              <div className={c.productTop}>
                <div className="min-w-0">
                  <span className={c.service}>
                    {plan ? plan.serviceType : t("جهاز VIP", "VIP device")}
                    {mode === "RENEW" ? ` · ${t("تجديد", "Renewal")}` : mode === "UPGRADE" ? ` · ${t("ترقية", "Upgrade")}` : ""}
                  </span>
                  <p className={c.productName} dir="auto" data-testid="selected-package-name">
                    {plan ? plan.name : fixedDevice?.name}
                  </p>
                  {plan ? <p className={cn(c.productDuration, "nums")}>{formatDuration(plan.durationMonths, language)}</p> : null}
                </div>
                <p className={cn(c.productPrice, "nums")}>{formatPrice(plan ? plan.price : fixedDevice?.price ?? 0, language)}</p>
              </div>
              {description ? (
                <p dir="auto" className={c.productText}>
                  {description}
                </p>
              ) : null}
              {features.length ? (
                <ul className={c.features}>
                  {features.map((feature) => (
                    <li key={feature}>
                      <span className={c.tick}>
                        <Check size={13} aria-hidden />
                      </span>
                      <span dir="auto">{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {/* Several lengths: switch here (the page reloads and the server prices it again). */}
          {plan && plan.options.length > 1 ? (
            <nav aria-label={t("مدة الاشتراك", "Subscription length")} data-testid="checkout-lengths">
              <p className={c.subhead}>{t("مدة الاشتراك", "Subscription length")}</p>
              <ul className={c.lengths}>
                {plan.options.map((option) => {
                  const query = new URLSearchParams(returnQuery);
                  query.set("option", String(option.id));
                  const active = option.id === plan.optionId;

                  return (
                    <li key={option.id}>
                      <Link
                        href={`/checkout?${query.toString()}`}
                        replace
                        scroll={false}
                        aria-current={active ? "true" : undefined}
                        className={cn(c.length, active && c.lengthOn)}
                        data-testid="checkout-length"
                        data-option-id={option.id}
                      >
                        <span className="nums">{formatDuration(option.durationMonths, language)}</span>
                        <span className="nums">{formatPrice(option.price, language)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}

          {/* VIP plans come with a compatible device. */}
          {needsDevice ? (
            <div>
              <p className={c.subhead}>{t("اختار جهاز VIP", "Pick your VIP device")}</p>
              <p className={c.subnote}>{t("اخترنالك الأرخص، وتكدر تبدّله.", "We picked the cheapest; you can switch.")}</p>
              {devices.length ? (
                <fieldset>
                  <legend className="sr-only">{t("الجهاز", "Device")}</legend>
                  <div className={c.choices}>
                    {devices.map((item) => {
                      const selected = deviceId === item.id;

                      return (
                        <label key={item.id} className={cn(c.choice, selected && c.choiceVipOn)}>
                          <input type="radio" name="deviceChoice" value={item.id} checked={selected} onChange={() => setDeviceId(item.id)} className="sr-only" />
                          <span className={c.choiceIcon}>{selected ? <CheckCircle2 size={20} aria-hidden /> : <Cpu size={20} aria-hidden />}</span>
                          <span className="min-w-0">
                            <b dir="auto">{item.name}</b>
                            <small dir="auto" className="line-clamp-2">
                              {item.description}
                            </small>
                            <span className={cn(c.choicePrice, "nums")}>+ {formatPrice(item.price, language)}</span>
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
            <p className={c.lineText}>
              {t(
                "حتى نتابع طلبك ونرسلك بيانات الاشتراك، تحتاج حساب. سجّل دخولك أو أنشئ حساب بدقيقة، وترجع لهنا بنفس الاختيار.",
                "You need an account so we can follow up your order and send your subscription details. Sign in or create one in a minute and you'll come back here with the same choice.",
              )}
            </p>
            <div className={c.actions}>
              <Link href={signInHref} className={cn(c.btn, c.btnPrimary)}>
                <LogIn size={17} aria-hidden />
                {t("تسجيل الدخول", "Sign in")}
              </Link>
              <Link href={registerHref} className={cn(c.btn, c.btnGhost)}>
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
                <div className={cn(c.choices, c.choicesFlush)}>
                  {contactOptions.map((option) => (
                    <label key={option} className={cn(c.choice, c.choiceRow, contact === option && c.choiceOn)}>
                      <input
                        type="radio"
                        name="contactChoice"
                        value={option}
                        checked={contact === option}
                        onChange={() => setContact(option)}
                        className="sr-only"
                      />
                      <span className={c.choiceIcon}>{contactMeta[option].icon}</span>
                      <span className="min-w-0 flex-1">
                        <b>{contactMeta[option].label}</b>
                        <small>{contactMeta[option].hint}</small>
                      </span>
                      {contact === option ? <CheckCircle2 size={20} className={c.choiceCheck} aria-hidden /> : null}
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
                  className={c.textarea}
                  placeholder={t("مثلًا: أفضل وقت للتواصل", "e.g. the best time to reach you")}
                />
              </Field>
            </Section>
          </>
        )}
      </div>

      {/* ---------------- Summary ---------------- */}
      <aside className={c.aside}>
        <div className={cn(c.summary, isVip && c.summaryVip)} data-testid="checkout-summary">
          <h2>{t("ملخص الطلب", "Order summary")}</h2>
          {user ? (
            <div className={c.customer} data-testid="checkout-customer">
              <span className={c.avatar}>
                <CircleUserRound size={20} aria-hidden />
              </span>
              <dl className="min-w-0">
                <dt className="sr-only">{t("اسم العميل", "Customer name")}</dt>
                <dd className={c.customerName}>{user.name}</dd>
                <dt className="sr-only">{t("رقم الهاتف", "Phone")}</dt>
                <dd className={cn(c.customerPhone, "nums")} dir="ltr">
                  {user.phone}
                </dd>
              </dl>
            </div>
          ) : null}
          <dl className={c.rows}>
            {plan ? (
              <div className={c.row}>
                <dt>{mode === "RENEW" ? t("تجديد", "Renewal") : mode === "UPGRADE" ? t("ترقية إلى", "Upgrade to") : t("الباقة", "Plan")}</dt>
                <dd>
                  {plan.name}
                  <span className={cn(c.pill, plan.serviceType === "VIP" && c.pillVip)}>{plan.serviceType}</span>
                </dd>
              </div>
            ) : null}
            {plan ? (
              <div className={c.row}>
                <dt>{mode === "RENEW" ? t("مدة التجديد", "Renewal length") : t("المدة", "Duration")}</dt>
                <dd className="nums" data-testid="summary-duration" data-months={plan.durationMonths}>
                  {formatDuration(plan.durationMonths, language)}
                  <small>
                    {mode === "RENEW"
                      ? t("تُضاف إلى تاريخ انتهاء اشتراكك بعد تأكيد الدفع", "Added to your expiry date once payment is confirmed")
                      : t("تبدأ من يوم التفعيل بعد تأكيد الدفع", "Starts on activation, after payment is confirmed")}
                  </small>
                </dd>
              </div>
            ) : null}
            {plan ? (
              <div className={c.row}>
                <dt>{t("سعر الباقة", "Plan price")}</dt>
                <dd className="nums">{formatPrice(plan.price, language)}</dd>
              </div>
            ) : null}
            {plan?.points ? (
              <div className={c.row} data-testid="summary-points">
                <dt>{t("نقاط شاشتنا", "Shashtna Points")}</dt>
                <dd className="nums">{t(`هذا الطلب يعطيك ${plan.points} نقطة`, `This order earns ${plan.points} points`)}</dd>
              </div>
            ) : null}
            {needsDevice || fixedDevice ? (
              <div className={c.row}>
                <dt>{device ? device.name : t("الجهاز", "Device")}</dt>
                <dd className="nums">{device ? formatPrice(device.price, language) : "—"}</dd>
              </div>
            ) : null}
            {user ? (
              <div className={c.row}>
                <dt>{t("التواصل", "Contact")}</dt>
                <dd data-testid="summary-contact">{contactMeta[contact].label}</dd>
              </div>
            ) : null}
            <div className={c.totalRow}>
              <dt>{t("الإجمالي", "Total")}</dt>
              <dd className="nums" data-testid="checkout-total">
                {totalText}
              </dd>
            </div>
          </dl>

          <p className={c.next} data-testid="checkout-next-step">
            <Info size={16} aria-hidden />
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

          {/* Phones and tablets: a fixed bar with the total and the one action. */}
          <div className={cn(c.bar, "fixed inset-x-0 bottom-0 z-30 lg:static")}>
            <div className={c.barTotal}>
              <span>{t("الإجمالي", "Total")}</span>
              <span className="nums">{totalText}</span>
            </div>
            {guest ? (
              <Link href={signInHref} className={actionClass}>
                {t("سجّل دخولك وأكمل الطلب", "Sign in to confirm")}
                <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
              </Link>
            ) : (
              <SubmitButton
                size="lg"
                variant={isVip ? "vip" : "primary"}
                className={actionClass}
                disabled={!ready}
                pendingLabel={t("جاري تأكيد الطلب...", "Confirming...")}
              >
                <CheckCircle2 size={18} aria-hidden />
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
    <section className={c.panel}>
      <div className={c.panelHead}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
