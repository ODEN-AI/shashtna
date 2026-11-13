import type { Metadata } from "next";
import { ArrowRight, MessageSquarePlus, RotateCcw } from "lucide-react";

import { closeChatAction } from "@/app/(site)/(account)/support/chat/actions";
import { CustomerChat } from "@/app/components/account/CustomerChat";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { ErrorState, Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { CHAT_STATUS_LABELS, isChatStatus } from "@/src/lib/chat";
import { isStaffRole } from "@/src/lib/roles";
import { requireCustomer } from "@/src/server/auth";
import { chatConfigured, chatEnabled, getCustomerChat } from "@/src/server/chat";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المساعد" };

/** My Shashtna → Assistant: chat with the AI customer agent (docs/site-chat.md). */
export default async function ChatPage() {
  const user = await requireCustomer("/support/chat");
  const { t, lang } = await getI18n();

  let chat: Awaited<ReturnType<typeof getCustomerChat>> = null;
  let enabled = false;
  let failed = false;

  try {
    [chat, enabled] = await Promise.all([getCustomerChat(user.id), chatEnabled()]);
  } catch (error) {
    console.error("CHAT_PAGE_ERROR:", error instanceof Error ? error.message : error);
    failed = true;
  }

  const staff = isStaffRole(user.role);
  const available = enabled && chatConfigured() && !staff;
  const status = chat?.conversation.status ?? null;
  // Why the message box is locked, shown inside it (null = open).
  const lockedReason = staff
    ? t("الدردشة للعملاء. ردّ على الزبائن من لوحة التحكم ← المحادثات.", "The chat is for customers. Reply to customers from the console → Chats.")
    : !available
      ? t("المساعد متوقف حالياً. افتح تذكرة دعم وفريق شاشتنا يرد عليك.", "The assistant is off right now. Open a support ticket and the team will reply.")
      : null;

  return (
    <div className="space-y-6">
      <LinkButton href="/support" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("الدعم الفني", "Support")}
      </LinkButton>

      <PageHeader
        title={t("مساعد شاشتنا", "Shashtna assistant")}
        description={t(
          "اسأل عن اشتراكك وطلباتك، أو احچي مشكلتك، والمساعد يرد عليك بالحال. إذا احتجت موظف، المساعد يحوّلك لفريق شاشتنا ويردون عليك هنا.",
          "Ask about your subscription and orders, or describe a problem, and the assistant replies right away. If you need a person, it passes you to the Shashtna team, who reply here.",
        )}
      />

      {failed ? (
        <ErrorState title={t("ما كدرنا نفتح المحادثة", "Couldn't open the chat")} description={t("حدّث الصفحة بعد شوية.", "Refresh the page in a moment.")} />
      ) : (
        <>
          {staff ? (
            <Notice tone="info">{t("هذي الصفحة للعملاء. محادثات العملاء تلكاها بلوحة التحكم ← المحادثات.", "This page is for customers. Customer chats are in the console → Chats.")}</Notice>
          ) : !available ? (
            <Notice tone="warning" title={t("المساعد غير متاح حاليًا", "The assistant isn't available right now")}>
              {t("افتح تذكرة دعم وفريق شاشتنا يرد عليك.", "Open a support ticket and the Shashtna team will reply.")}
              <div className="mt-3">
                <LinkButton href="/support/new" size="sm">
                  <MessageSquarePlus size={16} aria-hidden />
                  {t("تذكرة جديدة", "New ticket")}
                </LinkButton>
              </div>
            </Notice>
          ) : status === "HANDOVER" ? (
            <Notice tone="info" title={t("محادثتك عند فريق شاشتنا", "Your chat is with the Shashtna team")}>
              {t("راح يردون عليك هنا، ويوصلك إشعار.", "They'll reply here and you'll be notified.")}
            </Notice>
          ) : null}

          <Card className="p-5 sm:p-6">
            {status && isChatStatus(status) ? (
              <div className="mb-4 flex items-center justify-between gap-3">
                <Badge tone={status === "HANDOVER" ? "info" : "brand"}>{CHAT_STATUS_LABELS[status][lang]}</Badge>
                <form action={closeChatAction}>
                  <SubmitButton variant="ghost" size="sm" pendingLabel={t("لحظة…", "One moment…")}>
                    <RotateCcw size={14} aria-hidden />
                    {t("محادثة جديدة", "New chat")}
                  </SubmitButton>
                </form>
              </div>
            ) : null}
            <CustomerChat messages={chat?.messages ?? []} status={status} lockedReason={lockedReason} />
          </Card>

          <p className="text-xs leading-6 text-ink-3">
            {t(
              "المساعد يجاوب من دليل شاشتنا وحالة اشتراكك بس، وما يطلب منك كلمة سر أو رقم بطاقة. ما يفعّل اشتراك ولا يأكد دفع: هذي يسويها الفريق.",
              "The assistant answers from Shashtna's guide and your subscription status only, and never asks for a password or card number. It doesn't activate or confirm payments: the team does that.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
