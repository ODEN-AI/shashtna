import { Bot, Headphones, UserRound } from "lucide-react";

import { formatDateTime, type Lang } from "@/src/lib/i18n";

import { cn } from "./cn";

export type ChatBubble = { id: number | string; sender: string; body: string; createdAt: string; pending?: boolean };

/** A site-chat conversation (customer, AI assistant, Shashtna team). `perspective` is the side aligned to the end. */
export function ChatThread({ messages, lang, perspective }: { messages: ChatBubble[]; lang: Lang; perspective: "CUSTOMER" | "STAFF" }) {
  const isAr = lang === "ar";
  const who = (sender: string) =>
    sender === "AI" ? (isAr ? "مساعد شاشتنا" : "Shashtna assistant") : sender === "STAFF" ? (isAr ? "فريق شاشتنا" : "Shashtna team") : perspective === "CUSTOMER" ? (isAr ? "أنت" : "You") : isAr ? "العميل" : "Customer";

  return (
    <ol className="space-y-4" aria-label={isAr ? "المحادثة" : "Conversation"}>
      {messages.map((message) => {
        const mine = perspective === "CUSTOMER" ? message.sender === "CUSTOMER" : message.sender !== "CUSTOMER";
        const Icon = message.sender === "AI" ? Bot : message.sender === "STAFF" ? Headphones : UserRound;

        return (
          <li key={message.id} className={cn("flex gap-3", mine ? "flex-row-reverse" : "flex-row", message.pending && "opacity-70")}>
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                message.sender === "AI" ? "border-brand/40 bg-brand/10 text-brand-ink" : message.sender === "STAFF" ? "border-glow/40 bg-glow/10 text-glow" : "border-line-strong bg-surface-3 text-ink-2",
              )}
              aria-hidden
            >
              <Icon size={16} />
            </span>
            <div className={cn("min-w-0 max-w-[85%] sm:max-w-[75%]", mine && "text-end")}>
              <div className={cn("rounded-2xl px-4 py-3 text-start text-sm leading-7", mine ? "bg-brand text-white" : "border border-line bg-surface-2 text-ink")}>
                <p className="whitespace-pre-wrap break-words" dir="auto">
                  {message.body}
                </p>
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {who(message.sender)}
                {" · "}
                {message.pending ? (isAr ? "يرسل…" : "Sending…") : <span className="nums">{formatDateTime(message.createdAt, lang)}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
