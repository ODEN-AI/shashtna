import { Headphones, UserRound } from "lucide-react";

import { formatDateTime, type Lang } from "@/src/lib/i18n";
import type { SupportMessage } from "@/src/lib/support-store";

import { cn } from "./cn";

export function TicketThread({
  messages,
  lang,
  perspective,
}: {
  messages: SupportMessage[];
  lang: Lang;
  /** Whose side of the conversation is "mine" (aligned to the end). */
  perspective: "CUSTOMER" | "ADMIN";
}) {
  const isAr = lang === "ar";

  return (
    <ol className="space-y-4" aria-label={isAr ? "المحادثة" : "Conversation"}>
      {messages.map((message) => {
        const mine = message.sender === perspective;
        const staff = message.sender === "ADMIN";

        return (
          <li key={message.id} className={cn("flex gap-3", mine ? "flex-row-reverse" : "flex-row")}>
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                staff ? "border-glow/40 bg-glow/10 text-glow" : "border-line-strong bg-surface-3 text-ink-2",
              )}
              aria-hidden
            >
              {staff ? <Headphones size={16} /> : <UserRound size={16} />}
            </span>
            <div className={cn("max-w-[85%] sm:max-w-[75%]", mine && "text-end")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-start text-sm leading-7",
                  mine ? "bg-brand text-white" : "border border-line bg-surface-2 text-ink",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.message}</p>
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {staff ? (isAr ? "فريق الدعم" : "Support team") : message.senderName || (isAr ? "أنت" : "You")}
                {" · "}
                <span className="nums">{formatDateTime(message.createdAt, lang)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
