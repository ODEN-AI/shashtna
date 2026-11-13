import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { Card } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState, Notice } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { CHAT_HANDOVER_LABELS, CHAT_STATUS_LABELS, isChatStatus, isHandoverReason } from "@/src/lib/chat";
import { formatDateTime } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { chatConfigured, chatEnabled, listChatsForStaff } from "@/src/server/chat";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المحادثات" };

/** Admin → Chats: customer chats with the AI assistant; handed-over ones first (docs/site-chat.md). */
export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { allowed } = await requireStaffPage("/admin/chats", "support");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, params, enabled] = await Promise.all([getI18n(), searchParams, chatEnabled()]);
  const filter = params.filter === "all" ? "all" : "waiting";
  const chats = await listChatsForStaff(filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("المحادثات", "Chats")}
        description={t(
          "محادثات العملاء ويّه مساعد شاشتنا. لما المساعد ما يكدر يحل شي، أو الزبون يكول دفع، أو يطلب موظف، المحادثة تجيك هنا والمساعد يسكت لحد ما تردها إله.",
          "Customer chats with the Shashtna assistant. When it can't solve something, the customer says they paid, or asks for a person, the chat comes here and the assistant stays silent until you hand it back.",
        )}
      />

      {!enabled || !chatConfigured() ? (
        <Notice tone="warning" title={t("مساعد العملاء متوقف", "The customer assistant is off")}>
          {t("شغّله من الإعدادات ← مساعدي الذكاء الاصطناعي، بعد ما تملأ «دليل الحلول».", "Switch it on in Settings → AI assistants, after filling the Playbook.")}
        </Notice>
      ) : null}

      <LinkTabs
        label={t("المحادثات", "Chats")}
        active={filter}
        tabs={[
          { key: "waiting", href: "/admin/chats", label: t("بانتظار الفريق", "Waiting for the team") },
          { key: "all", href: "/admin/chats?filter=all", label: t("الكل", "All") },
        ]}
      />

      {!chats.length ? (
        <EmptyState icon={<MessagesSquare />} title={filter === "waiting" ? t("ماكو محادثات تنتظرك", "No chats waiting for you") : t("ماكو محادثات بعد", "No chats yet")} />
      ) : (
        <ul className="space-y-3">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Card as="article" className="p-0">
                <Link href={`/admin/chats/${chat.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 hover:bg-surface-2 sm:p-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{chat.customerName}</span>
                    {chat.handoverNote ? (
                      <span className="mt-1 block truncate text-sm text-ink-3" dir="auto">
                        {chat.handoverNote}
                      </span>
                    ) : null}
                  </span>
                  {chat.status === "HANDOVER" && isHandoverReason(chat.handoverReason) ? <Badge tone={chat.handoverReason === "PAYMENT" ? "success" : "warning"}>{CHAT_HANDOVER_LABELS[chat.handoverReason][lang]}</Badge> : null}
                  {isChatStatus(chat.status) ? <Badge tone={chat.status === "HANDOVER" ? "info" : "neutral"}>{CHAT_STATUS_LABELS[chat.status][lang]}</Badge> : null}
                  <span className="nums text-xs text-ink-3">{formatDateTime(chat.updatedAt, lang)}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
