"use client";

import { useActionState, useState } from "react";
import { Check, CheckCircle2, CircleUserRound, Cpu, Info, Pencil } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/app/components/LanguageProvider";
import { Badge } from "@/app/ui/Badge";
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
  imageUrl: string | null;
};

export type CheckoutDevice = {
  id: number;
  name: string;
  price: number;
  description: string;
};

export type CheckoutMode = "NEW" | "RENEW" | "UPGRADE" | "DEVICE_PURCHASE";

/**
 * Confirms the one selection the customer already made. Prices shown here
 * are for display only: the server recalculates everything from the
 * catalogue when the order is created.
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
  user: { name: string; phone: string };
}) {
  const { t, language } = useLanguage();
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrderAction, null);
  const [deviceId, setDeviceId] = useState<number | null>(initialDevice);

  const needsDevice = mode !== "DEVICE_PURCHASE" && mode !== "RENEW" && plan?.serviceType === "VIP";
  const device = fixedDevice ?? (needsDevice ? devices.find((item) => item.id === deviceId) ?? null : null);
  const total = (plan?.price ?? 0) + (device?.price ?? 0);
  const ready = mode === "DEVICE_PURCHASE" ? Boolean(fixedDevice) : Boolean(plan) && (!needsDevice || Boolean(device));

  const title = mode === "DEVICE_PURCHASE" ? t("ملخص الطلب", "Order summary") : t("ملخص الباقة", "Plan summary");
  const rows = [
    plan ? { label: t("المدة", "Duration"), value: plan.durationLabel } : null,
    needsDevice || fixedDevice ? { label: t("الجهاز", "Device"), value: device?.name ?? t("اختار الجهاز بالأسفل", "Choose below") } : null,
    plan ? { label: t("السعر", "Price"), value: formatPrice(plan.price, language), nums: true } : null,
    device ? { label: plan ? t("سعر الجهاز", "Device price") : t("السعر", "Price"), value: formatPrice(device.price, language), nums: true } : null,
  ].filter(Boolean) as { label: string; value: string; nums?: boolean }[];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="requestType" value={mode} />
      <input type="hidden" name="planSlug" value={mode === "DEVICE_PURCHASE" ? "" : plan?.slug ?? ""} />
      <input type="hidden" name="deviceId" value={device?.id ?? ""} />
      <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />

      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}

      {/* ---------------- The selected package ---------------- */}
      <section aria-labelledby="summary-heading" data-testid="selected-package" className="surface-raised overflow-hidden rounded-panel">
        <div className="flex items-start gap-4 p-5 sm:p-6">
          {plan?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plan.imageUrl} alt="" aria-hidden className="h-20 w-16 shrink-0 rounded-xl bg-black/30 object-cover sm:h-24 sm:w-20" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p id="summary-heading" className="text-xs font-semibold text-ink-3">{title}</p>
            <h2 className="mt-1 text-xl font-bold leading-8 text-ink" data-testid="selected-package-name">
              {plan ? plan.name : fixedDevice?.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {plan ? <Badge tone={plan.serviceType === "VIP" ? "glow" : "brand"}>{plan.serviceType}</Badge> : <Badge tone="glow">{t("جهاز VIP", "VIP device")}</Badge>}
              {mode === "RENEW" ? <Badge>{t("تجديد", "Renewal")}</Badge> : mode === "UPGRADE" ? <Badge>{t("ترقية", "Upgrade")}</Badge> : null}
            </div>
          </div>
          <Link
            href={changeHref}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink"
          >
            <Pencil size={13} aria-hidden />
            {mode === "DEVICE_PURCHASE" ? t("تغيير", "Change") : t("تغيير الباقة", "Change plan")}
          </Link>
        </div>

        <dl className="divide-y divide-line border-t border-line px-5 sm:px-6">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <dt className="text-ink-3">{row.label}</dt>
              <dd className={cn("text-end font-semibold text-ink", row.nums && "nums")}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-4 border-t border-line bg-brand/10 px-5 py-4 sm:px-6">
          <span className="text-base font-bold text-ink">{t("الإجمالي", "Total")}</span>
          <span className="nums text-2xl font-bold text-ink" data-testid="checkout-total">
            {ready ? formatPrice(total, language) : "—"}
          </span>
        </div>
      </section>

      {/* ---------------- VIP device (only when the plan needs one) ---------------- */}
      {needsDevice ? (
        <section aria-labelledby="device-heading" className="surface rounded-panel p-5 sm:p-6">
          <h2 id="device-heading" className="text-base font-bold text-ink">{t("اختار جهاز VIP", "Choose your VIP device")}</h2>
          <p className="mt-1 text-sm text-ink-3">{t("هاي الباقة تشتغل ويا جهاز VIP متوافق.", "This plan works with a compatible VIP device.")}</p>
          {devices.length ? (
            <fieldset className="mt-4">
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
                    <input
                      type="radio"
                      name="deviceChoice"
                      value={item.id}
                      checked={deviceId === item.id}
                      onChange={() => setDeviceId(item.id)}
                      className="sr-only"
                    />
                    {deviceId === item.id ? (
                      <Check size={20} className="mt-0.5 shrink-0 text-glow" aria-hidden />
                    ) : (
                      <Cpu size={20} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                    )}
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
            <Notice tone="warning" className="mt-4">
              {t(
                "ماكو جهاز VIP متوافق مع هاي الباقة حاليًا. تواصل ويانا أو اختار باقة ثانية.",
                "No compatible VIP device is available for this plan right now. Contact us or choose another plan.",
              )}
            </Notice>
          )}
        </section>
      ) : null}

      {/* ---------------- Account & note ---------------- */}
      <section className="surface rounded-panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <CircleUserRound size={22} className="shrink-0 text-brand-ink" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-bold text-ink">{user.name}</p>
            <p className="nums text-ink-3" dir="ltr">
              {user.phone}
            </p>
          </div>
        </div>
        <Field label={t("ملاحظة (اختياري)", "Note (optional)")} htmlFor="customerNote" className="mt-5">
          <Textarea
            id="customerNote"
            name="customerNote"
            maxLength={500}
            rows={2}
            placeholder={t("إذا عندك أي ملاحظة على الطلب اكتبها هنا", "Anything we should know about this order")}
          />
        </Field>
      </section>

      {/* ---------------- What happens next ---------------- */}
      <div className="flex items-start gap-3 rounded-panel border border-info/30 bg-info/10 p-4 text-[15px] leading-7 text-ink" data-testid="checkout-next-step">
        <Info size={20} className="mt-1 shrink-0 text-info" aria-hidden />
        <p>
          {t(
            "بعد تأكيد الطلب، ستنتقل إلى حسابك لإكمال الدفع وإرسال إثبات الدفع.",
            "After you confirm, you'll go to your account to pay and send the payment proof.",
          )}
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <SubmitButton size="lg" className="w-full" disabled={!ready} pendingLabel={t("جاري تأكيد الطلب...", "Confirming...")}>
          <CheckCircle2 size={17} aria-hidden />
          {ready ? t("تأكيد الطلب", "Confirm order") : t("اختار الجهاز أولًا", "Choose a device first")}
        </SubmitButton>
      </div>
    </form>
  );
}
