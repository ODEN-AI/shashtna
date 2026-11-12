"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import { draftTicketReplyAction, type DraftState } from "@/app/admin/support/[id]/draft-actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Button } from "@/app/ui/Button";
import { Card } from "@/app/ui/Card";
import { Input } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";

/**
 * «مسودة رد» on a support ticket: the Customer assistant drafts a reply; staff
 * put it in the reply box, edit it and send it themselves. Nothing is sent here.
 */
export function TicketDraft({ ticketId, replyFieldId }: { ticketId: string; replyFieldId: string }) {
  const { t } = useLanguage();
  const [state, formAction] = useActionState<DraftState, FormData>(draftTicketReplyAction, null);
  const [used, setUsed] = useState(false);

  const applyDraft = (draft: string) => {
    const field = document.getElementById(replyFieldId) as HTMLTextAreaElement | null;

    if (!field) return;
    field.value = draft;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
    setUsed(true);
  };

  return (
    <Card className="p-5 sm:p-6">
      <form action={(formData) => { setUsed(false); formAction(formData); }} className="space-y-3">
        <input type="hidden" name="ticketId" value={ticketId} />
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <Sparkles className="size-4 text-brand" aria-hidden />
          {t("مسودة رد بالذكاء الاصطناعي", "AI reply draft")}
        </div>
        <Input name="note" maxLength={300} dir="auto" placeholder={t("ملاحظة للمساعد (اختياري): مثلاً «اطلب منه صورة للخطأ»", "Note for the assistant (optional): e.g. “ask for a screenshot of the error”")} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-3">{t("المساعد يقرا التذكرة وحالة اشتراكات العميل، بدون اسمه أو رقمه. ما ينرسل شي إلا إذا انت دزيته.", "The assistant reads the ticket and the customer's subscription status, never their name or number. Nothing is sent unless you send it.")}</p>
          <SubmitButton variant="secondary" size="sm" pendingLabel={t("يكتب...", "Writing...")}>
            {t("اكتب مسودة", "Draft a reply")}
          </SubmitButton>
        </div>
      </form>

      {state && !state.ok ? (
        <Notice className="mt-4" tone={state.code === "OFF" || state.code === "NOT_CONFIGURED" ? "warning" : "danger"} title={t("ما انكتبت المسودة", "No draft")}>
          {state.message}
        </Notice>
      ) : null}

      {state?.ok ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
          <p className="whitespace-pre-wrap break-words leading-7 text-ink" dir="auto">
            {state.draft}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => applyDraft(state.draft)}>
              {t("حطها بخانة الرد", "Put it in the reply box")}
            </Button>
            {used ? <span className="text-xs text-success">{t("انحطت. راجعها قبل الإرسال.", "Done. Review it before sending.")}</span> : null}
          </div>
          <p className="text-xs text-ink-3">{t("مسودة من الذكاء الاصطناعي: تأكد من كل معلومة قبل ما ترسلها.", "AI draft: check every detail before you send it.")}</p>
        </div>
      ) : null}
    </Card>
  );
}
