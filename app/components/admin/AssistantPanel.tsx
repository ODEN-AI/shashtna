"use client";

import { Bot, CornerDownLeft, Wrench } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { askAssistantAction, type AssistantState } from "@/app/admin/assistant/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Badge } from "@/app/ui/Badge";
import { Card } from "@/app/ui/Card";
import { Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";

const TOOL_LABELS: Record<string, { ar: string; en: string }> = {
  operations_today: { ar: "شغل اليوم", en: "Today's work" },
  automation_status: { ar: "حالة الأتمتة", en: "Automation status" },
  finance_facts: { ar: "أرقام المالية", en: "Finance figures" },
  finance_trend: { ar: "اتجاه المبيعات", en: "Sales trend" },
};

/** One assistant: one question, one answer, with the tools it read. Nothing here changes data. */
export function AssistantPanel({ agent, label, suggestions, disabled }: { agent: string; label: string; suggestions: { ar: string; en: string }[]; disabled: boolean }) {
  const { t, language } = useLanguage();
  const [state, formAction] = useActionState<AssistantState, FormData>(askAssistantAction, null);
  const [draft, setDraft] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="agent" value={agent} />
          <label htmlFor="question" className="block text-sm font-semibold text-ink-2">
            {t(`اسأل ${label}`, `Ask the ${label.toLowerCase()}`)}
          </label>
          <Textarea
            id="question"
            name="question"
            rows={3}
            maxLength={1000}
            required
            dir="auto"
            disabled={disabled}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && draft.trim()) formRef.current?.requestSubmit();
            }}
            placeholder={suggestions[0] ? t(`مثلاً: ${suggestions[0].ar}`, `e.g. ${suggestions[0].en}`) : undefined}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <CornerDownLeft className="size-3.5" aria-hidden />
              {t("Ctrl + Enter للإرسال", "Ctrl + Enter to send")}
            </p>
            <SubmitButton disabled={disabled || !draft.trim()} pendingLabel={t("يفكّر...", "Thinking...")}>
              {t("اسأل", "Ask")}
            </SubmitButton>
          </div>
        </form>

        {!disabled ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((item) => {
              const text = language === "ar" ? item.ar : item.en;

              return (
                <button
                  key={item.en}
                  type="button"
                  onClick={() => setDraft(text)}
                  className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-start text-xs text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
                >
                  {text}
                </button>
              );
            })}
          </div>
        ) : null}
      </Card>

      {state && !state.ok ? (
        <Notice tone={state.code === "OFF" || state.code === "NOT_CONFIGURED" ? "warning" : "danger"} title={t("ما وصل جواب", "No answer")}>
          {state.message}
        </Notice>
      ) : null}

      {state?.ok ? (
        <Card className="p-5 sm:p-6" as="section">
          <p className="mb-3 text-xs text-ink-3" dir="auto">
            {state.question}
          </p>
          <div className="flex gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
              <Bot className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-7 text-ink" dir="auto">
              {state.answer}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs text-ink-3">
            <Wrench className="size-3.5" aria-hidden />
            <span>{t("قرا من:", "Read from:")}</span>
            {state.tools.length ? (
              state.tools.map((call, index) => (
                <Badge key={`${call.tool}-${index}`} tone={call.ok ? "neutral" : "danger"}>
                  {TOOL_LABELS[call.tool] ? (language === "ar" ? TOOL_LABELS[call.tool].ar : TOOL_LABELS[call.tool].en) : call.tool}
                </Badge>
              ))
            ) : (
              <span>{t("ولا أداة", "no tools")}</span>
            )}
          </div>
          {state.limited ? (
            <p className="mt-3 text-xs text-warning">{t("وكف المساعد عند الحد المسموح لهذا السؤال.", "The assistant stopped at this question's limit.")}</p>
          ) : null}
          <p className="mt-3 text-xs text-ink-3">{t("الجواب من الذكاء الاصطناعي: تأكد من الأرقام المهمة بصفحتها قبل ما تتصرف.", "AI answer: check important numbers on their own page before acting.")}</p>
        </Card>
      ) : null}
    </div>
  );
}
