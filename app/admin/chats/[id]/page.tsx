import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { chatStatusAction, replyChatAction } from "@/app/admin/chats/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { ChatThread } from "@/app/ui/ChatThread";
import { Field, Select, Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { CHAT_HANDOVER_LABELS, CHAT_LIMITS, CHAT_STATUS_LABELS, isChatStatus, isHandoverReason } from "@/src/lib/chat";
import { formatDateTime } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { getChatForStaff } from "@/src/server/chat";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "محادثة" };

function StatusButton({ id, status, label, variant = "secondary" }: { id: number; status: string; label: string; variant?: "secondary" | "ghost" }) {
  return (
    <ActionForm action={chatStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant} size="sm">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

/** Admin → Chats → one chat: read it, reply as the team, take over or hand back to the assistant. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const { allowed } = await requireStaffPage(`/admin/chats/${encodeURIComponent(rawId)}`, "support");

  if (!allowed) {
    return <Forbidden />;
  }

  const chat = await getChatForStaff(id);

  if (!chat) {
    notFound();
  }

  const { t, lang } = await getI18n();
  const { conversation } = chat;
  const status = isChatStatus(conversation.status) ? conversation.status : "AI";

  return (
    <div className="space-y-6">
      <LinkButton href="/admin/chats" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("المحادثات", "Chats")}
      </LinkButton>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {status === "HANDOVER" ? (
            <Notice tone="info" title={isHandoverReason(conversation.handoverReason) ? CHAT_HANDOVER_LABELS[conversation.handoverReason][lang] : t("عند الفريق", "With the team")}>
              {conversation.handoverNote ? <span dir="auto">{conversation.handoverNote}</span> : t("المساعد ساكت لحد ما ترجّع المحادثة إله.", "The assistant stays silent until you hand the chat back.")}
            </Notice>
          ) : null}

          <Card className="p-5 sm:p-6">
            {chat.messages.length ? <ChatThread messages={chat.messages} lang={lang} perspective="STAFF" /> : <p className="text-sm text-ink-3">{t("ماكو رسائل.", "No messages.")}</p>}
          </Card>

          <Card className="p-5 sm:p-6">
            <ActionForm action={replyChatAction} resetOnSuccess className="space-y-4">
              <input type="hidden" name="id" value={conversation.id} />
              <Field label={t("ردك للزبون", "Your reply to the customer")} htmlFor="message" hint={t("يوصله إشعار بحسابه.", "They're notified in their account.")}>
                <Textarea id="message" name="message" rows={4} maxLength={CHAT_LIMITS.messageChars} dir="auto" required />
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t("بعد الرد", "After replying")} htmlFor="after" className="min-w-52">
                  <Select id="after" name="after" defaultValue="keep">
                    <option value="keep">{t("أبقى ويّا الزبون", "I stay on the chat")}</option>
                    <option value="handBack">{t("رجّعها للمساعد", "Hand back to the assistant")}</option>
                    <option value="close">{t("سكّر المحادثة", "Close the chat")}</option>
                  </Select>
                </Field>
                <SubmitButton pendingLabel={t("جاري الإرسال...", "Sending...")}>{t("إرسال", "Send")}</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <CardHeader title={t("العميل", "Customer")} />
            {chat.customer ? (
              <Link href={`/admin/customers/${chat.customer.id}`} className="mt-4 block font-bold text-ink hover:text-brand-ink">
                {chat.customer.name}
              </Link>
            ) : (
              <p className="mt-4 text-sm text-ink-3">—</p>
            )}
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("الحالة", "Status")}</dt>
                <dd>
                  <Badge tone={status === "HANDOVER" ? "info" : "neutral"}>{CHAT_STATUS_LABELS[status][lang]}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">{t("بدأت", "Started")}</dt>
                <dd className="nums text-ink-2">{formatDateTime(conversation.createdAt, lang)}</dd>
              </div>
            </dl>
          </Card>
          <Card className="space-y-3 p-6">
            <CardHeader title={t("التحكم", "Control")} />
            {status !== "HANDOVER" ? <StatusButton id={conversation.id} status="HANDOVER" label={t("استلم المحادثة (يسكت المساعد)", "Take over (assistant goes silent)")} /> : null}
            {status !== "AI" ? <StatusButton id={conversation.id} status="AI" label={t("رجّعها للمساعد", "Hand back to the assistant")} /> : null}
            {status !== "CLOSED" ? <StatusButton id={conversation.id} status="CLOSED" label={t("سكّر المحادثة", "Close the chat")} variant="ghost" /> : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
