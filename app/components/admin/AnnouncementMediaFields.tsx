"use client";

import { Film, ImageIcon } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { cn } from "@/app/ui/cn";

import { ImageUploadField } from "./ImageUploadField";

/**
 * Media for an ad / offer / news item: the admin picks IMAGE or VIDEO. With
 * VIDEO the image becomes the poster (shown before playback, under reduced
 * motion and wherever video is not supported), so it stays a real image for
 * every other client that reads imageUrl.
 */
export function AnnouncementMediaFields({
  mediaType,
  imageUrl,
  videoUrl,
}: {
  mediaType?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}) {
  const { t } = useLanguage();
  const [type, setType] = useState(String(mediaType ?? "IMAGE").toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE");

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink-2">{t("نوع الوسائط", "Media type")}</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {[
          { value: "IMAGE", label: t("صورة", "Image"), icon: <ImageIcon size={16} aria-hidden /> },
          { value: "VIDEO", label: t("فيديو", "Video"), icon: <Film size={16} aria-hidden /> },
        ].map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
              type === option.value ? "border-brand/70 bg-brand/15 text-ink" : "border-line-strong bg-surface-2 text-ink-2 hover:text-ink",
            )}
          >
            <input
              type="radio"
              name="mediaType"
              value={option.value}
              checked={type === option.value}
              onChange={() => setType(option.value)}
              className="sr-only"
            />
            {option.icon}
            {option.label}
          </label>
        ))}
      </div>
      <ImageUploadField
        name="imageUrl"
        defaultValue={imageUrl}
        label={type === "VIDEO" ? t("صورة الغلاف (Poster)", "Poster image") : t("الصورة (اختياري)", "Image (optional)")}
        hint={type === "VIDEO" ? t("تظهر قبل تشغيل الفيديو ولمن يفضّل تقليل الحركة.", "Shown before playback and to people who prefer reduced motion.") : undefined}
      />
      {type === "VIDEO" ? (
        <ImageUploadField
          name="videoUrl"
          media="video"
          defaultValue={videoUrl}
          label={t("الفيديو", "Video")}
          hint={t("MP4 أو WEBM قصير (حتى 8MB)، بدون صوت. يتكرر تلقائيًا.", "A short MP4 or WEBM (up to 8MB), silent. It loops.")}
        />
      ) : null}
    </fieldset>
  );
}
