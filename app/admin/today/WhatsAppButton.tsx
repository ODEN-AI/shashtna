"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markWhatsAppAction } from "@/app/admin/today/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { cn } from "@/app/ui/cn";

/**
 * Opens the prefilled wa.me link in a new tab (synchronously, so popup
 * blockers allow it) and records the message in the outbox at the same time.
 */
export function WhatsAppButton({ href, subscriptionId, template, sent }: { href: string; subscriptionId: number; template: string; sent: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [pending, start] = useTransition();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="today-whatsapp"
      onClick={() => {
        start(async () => {
          await markWhatsAppAction(subscriptionId, template);
          router.refresh();
        });
      }}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors",
        sent ? "border-line text-ink-3 hover:text-ink" : "border-success/40 bg-success/10 text-success hover:bg-success/15",
        pending && "opacity-60",
      )}
    >
      <MessageCircle size={15} aria-hidden />
      {sent ? t("إرسال مرة ثانية", "Send again") : t("واتساب", "WhatsApp")}
    </a>
  );
}
