"use client";

import { ImageUp, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { cn } from "@/app/ui/cn";
import { PROOF_MAX_BYTES } from "@/src/lib/payment-proof";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 1600;

/** Re-encodes a photo as a JPEG no larger than MAX_EDGE px, or null if the browser can't read it. */
async function shrink(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "payment-proof.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * File input for the transfer screenshot (form field `paymentProof`). Shows a
 * preview of exactly what will be sent.
 */
export function ProofPicker({
  error: serverError,
  onChange,
}: {
  error?: string | null;
  onChange?: (hasFile: boolean) => void;
}) {
  const { t } = useLanguage();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }
  }, [preview]);

  function reset(message: string | null) {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setPreview(null);
    setError(message);
    onChange?.(false);
  }

  async function onSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      reset(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      reset(t("نوع الملف غير مدعوم. ارفع صورة بصيغة JPG أو PNG.", "Unsupported file. Upload a JPG or PNG image."));
      return;
    }

    if (file.size > MAX_SOURCE_BYTES) {
      reset(t("حجم الصورة كبير جدًا. ارفع لقطة شاشة للتحويل.", "The image is too large. Upload a screenshot of the transfer."));
      return;
    }

    setBusy(true);
    const small = await shrink(file);
    setBusy(false);

    let finalFile = file;

    if (small && small.size < file.size) {
      try {
        const transfer = new DataTransfer();
        transfer.items.add(small);
        input.files = transfer.files;
        finalFile = small;
      } catch {
        // Older browsers can't replace the selection; send the original.
      }
    } else if (!small && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reset(t("ما گدرنا نقرأ هاي الصورة. ارفع لقطة شاشة بصيغة JPG أو PNG.", "We couldn't read this image. Upload a JPG or PNG screenshot."));
      return;
    }

    if (finalFile.size > PROOF_MAX_BYTES) {
      reset(t("حجم الصورة كبير. ارفع صورة أصغر من 4 ميگابايت.", "The image is too large. Upload one under 4 MB."));
      return;
    }

    setError(null);
    setPreview({ url: URL.createObjectURL(finalFile), name: file.name, size: finalFile.size });
    onChange?.(true);
  }

  // A server error about the previous image no longer applies once a new one is chosen.
  const shownError = error ?? (preview ? null : serverError ?? null);

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name="paymentProof"
        accept="image/*"
        onChange={onSelect}
        className="sr-only"
        aria-describedby={shownError ? `${inputId}-error` : undefined}
        data-testid="payment-proof-input"
      />

      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-success/40 bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={t("صورة إثبات الدفع المختارة", "Selected payment proof")}
            className="max-h-80 w-full bg-black/30 object-contain"
            data-testid="payment-proof-preview"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <p className="min-w-0 text-xs text-ink-3">
              <span className="block font-semibold text-success">{t("الصورة جاهزة للإرسال", "Image ready to send")}</span>
              <span className="nums block truncate" dir="ltr">
                {preview.name} · {formatSize(preview.size)}
              </span>
            </p>
            <div className="flex gap-2">
              <label
                htmlFor={inputId}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-surface-3"
              >
                <RefreshCw size={15} aria-hidden />
                {t("تغيير الصورة", "Change")}
              </label>
              <button
                type="button"
                onClick={() => reset(null)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-3 hover:bg-surface-3 hover:text-ink"
              >
                <Trash2 size={15} aria-hidden />
                {t("حذف", "Remove")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
            shownError ? "border-danger/60 bg-danger/5" : "border-line-strong bg-surface-2 hover:border-brand/60 hover:bg-brand/5",
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink">
            <ImageUp size={22} aria-hidden />
          </span>
          <span className="text-base font-bold text-ink">
            {busy ? t("جاري تجهيز الصورة...", "Preparing image...") : t("اضغط هنا لاختيار صورة التحويل", "Tap to choose the transfer screenshot")}
          </span>
          <span className="text-xs text-ink-3">{t("صورة أو لقطة شاشة (JPG أو PNG)", "A photo or screenshot (JPG or PNG)")}</span>
        </label>
      )}

      {shownError ? (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm font-semibold text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
