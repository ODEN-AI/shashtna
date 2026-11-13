"use client";

import { SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { sendChatAction, type ChatActionState } from "@/app/(site)/(account)/support/chat/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Button } from "@/app/ui/Button";
import { ChatThread, type ChatBubble } from "@/app/ui/ChatThread";
import { Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { announceSessionExpired } from "@/app/ui/session-events";
import { CHAT_LIMITS } from "@/src/lib/chat";

/**
 * My Shashtna → Assistant. The customer's message shows at once; the agent's
 * reply (or the team's, after a handover) arrives with the page refresh the
 * action triggers. While the team has the chat, the page checks for replies
 * every 20 seconds.
 */
export function CustomerChat({ messages, status, disabled }: { messages: ChatBubble[]; status: string | null; disabled: boolean }) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ChatActionState, FormData>(sendChatAction, null);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.code === "UNAUTHENTICATED") announceSessionExpired();
  }, [state]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  useEffect(() => {
    if (status !== "HANDOVER") return;

    const timer = window.setInterval(() => router.refresh(), 20_000);

    return () => window.clearInterval(timer);
  }, [status, router]);

  const shown: ChatBubble[] = pending && sent ? [...messages, { id: "pending", sender: "CUSTOMER", body: sent, createdAt: new Date().toISOString(), pending: true }] : messages;

  return (
    <div className="space-y-4">
      {shown.length ? (
        <ChatThread messages={shown} lang={language} perspective="CUSTOMER" />
      ) : (
        <p className="py-6 text-center text-sm text-ink-3">{t("اكتب مشكلتك أو سؤالك، والمساعد يرد عليك هنا.", "Write your problem or question and the assistant replies here.")}</p>
      )}

      {pending && status !== "HANDOVER" ? (
        <p className="text-sm text-ink-3" role="status" aria-live="polite">
          {t("المساعد يكتب…", "The assistant is typing…")}
        </p>
      ) : null}

      <div ref={endRef} />

      {state && !state.ok && !pending ? (
        <Notice tone={state.code === "OFF" || state.code === "NOT_CONFIGURED" ? "warning" : "danger"} title={t("ما انرسلت", "Not sent")}>
          {state.message}
        </Notice>
      ) : null}

      <form
        ref={formRef}
        action={(formData) => {
          setSent(String(formData.get("message") ?? "").trim());
          setDraft("");
          formAction(formData);
        }}
        className="flex items-end gap-2 border-t border-line pt-4"
      >
        <label htmlFor="chat-message" className="sr-only">
          {t("رسالتك", "Your message")}
        </label>
        <Textarea
          id="chat-message"
          name="message"
          rows={2}
          dir="auto"
          maxLength={CHAT_LIMITS.messageChars}
          required
          disabled={disabled || pending}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (draft.trim()) formRef.current?.requestSubmit();
            }
          }}
          placeholder={t("اكتب رسالتك…", "Write your message…")}
          className="min-h-12 flex-1 resize-none"
        />
        <Button type="submit" disabled={disabled || pending || !draft.trim()} aria-label={t("إرسال", "Send")} className="shrink-0">
          <SendHorizontal size={18} className="rtl:rotate-180" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
