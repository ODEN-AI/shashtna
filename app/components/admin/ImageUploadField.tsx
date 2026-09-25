"use client";

import { ImageUp, Loader2, X } from "lucide-react";
import { useId, useState } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { inputClass } from "@/app/ui/Field";

/** Uploads an image through the existing media API and stores its URL in a hidden field. */
export function ImageUploadField({ name, defaultValue, label }: { name: string; defaultValue?: string | null; label: string }) {
  const { t } = useLanguage();
  const id = useId();
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/admin/media/upload", { method: "POST", body });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.imageUrl) {
        setError(data.message || t("تعذر رفع الصورة", "Upload failed"));
        return;
      }

      setUrl(data.imageUrl);
    } catch {
      setError(t("تعذر رفع الصورة", "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-ink-2">
        {label}
      </label>
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-center gap-3">
        {url ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-16 w-28 rounded-xl border border-line object-cover" />
            <button
              type="button"
              onClick={() => setUrl("")}
              className="absolute -end-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white"
              aria-label={t("إزالة الصورة", "Remove image")}
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        ) : null}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm font-semibold text-ink-2 hover:text-ink">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImageUp size={16} aria-hidden />}
          {busy ? t("جاري الرفع...", "Uploading...") : t("رفع صورة", "Upload image")}
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void upload(file);
              }
            }}
          />
        </label>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("أو الصق رابط https://", "or paste an https:// URL")}
          className={`${inputClass} h-10 max-w-xs flex-1 py-0 text-sm`}
          aria-label={t("رابط الصورة", "Image URL")}
        />
      </div>
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
