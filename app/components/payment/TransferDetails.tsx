"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { formatPrice } from "@/src/lib/i18n";

export type TransferInfo = { transferNumber: string; recipientName: string };

/** Clipboard API first; a hidden textarea for browsers that block it (e.g. in-app browsers). */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/**
 * The manual-transfer destination: amount, method, transfer number (with a
 * copy button), account name and step-by-step instructions.
 */
export function TransferDetails({ amount, info }: { amount: number | null; info: TransferInfo }) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const timer = useRef<number | undefined>(undefined);

  async function onCopy() {
    const ok = await copyText(info.transferNumber);
    setCopied(ok ? "ok" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2500);
  }

  const steps = [
    t("حوّل المبلغ إلى رقم التحويل.", "Transfer the amount to the transfer number."),
    t("بعد إتمام التحويل، ارفع إثبات الدفع.", "Once the transfer is done, upload the payment proof."),
    t("أرسل الإثبات حتى نراجع الطلب.", "Send the proof so we can review the order."),
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand/40 bg-brand/10 p-4 text-center sm:p-5">
        <p className="text-sm font-semibold text-ink-2">{t("المبلغ المطلوب", "Amount to pay")}</p>
        <p className="nums mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl" data-testid="transfer-amount">
          {amount !== null ? formatPrice(amount, language) : "—"}
        </p>
      </div>

      <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-2">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-sm text-ink-3">{t("طريقة الدفع", "Payment method")}</dt>
          <dd className="text-sm font-bold text-ink">{t("تحويل يدوي", "Manual transfer")}</dd>
        </div>

        <div className="px-4 py-4">
          <dt className="text-sm text-ink-3">{t("رقم التحويل", "Transfer number")}</dt>
          <dd className="mt-2 flex flex-wrap items-center gap-3">
            <span
              dir="ltr"
              data-testid="transfer-number"
              className="nums min-w-0 select-all break-all text-2xl font-bold tracking-[0.12em] text-ink sm:text-[28px]"
            >
              {info.transferNumber}
            </span>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand/50 bg-brand/15 px-4 text-sm font-bold text-ink transition hover:bg-brand/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {copied === "ok" ? <Check size={16} className="text-success" aria-hidden /> : <Copy size={16} aria-hidden />}
              {t("نسخ رقم التحويل", "Copy transfer number")}
            </button>
          </dd>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold">
            {copied === "ok" ? (
              <span className="text-success">{t("تم نسخ رقم التحويل", "Transfer number copied")}</span>
            ) : copied === "failed" ? (
              <span className="text-warning">{t("ما گدرنا ننسخ الرقم. اضغط عليه مطولًا وانسخه يدويًا.", "Couldn't copy. Long-press the number to copy it.")}</span>
            ) : null}
          </p>
        </div>

        {info.recipientName ? (
          <div className="px-4 py-3">
            <dt className="text-sm text-ink-3">{t("اسم المستفيد", "Recipient name")}</dt>
            <dd dir="ltr" data-testid="recipient-name" className="mt-1 break-words text-start text-base font-bold text-ink rtl:text-end">
              {info.recipientName}
            </dd>
          </div>
        ) : null}
      </dl>

      <div>
        <p className="text-sm font-bold text-ink">{t("شلون تدفع؟", "How to pay")}</p>
        <ol className="mt-3 space-y-2.5">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-[15px] leading-7 text-ink-2">
              <span className="nums mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
