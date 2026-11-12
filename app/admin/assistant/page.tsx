import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AssistantPanel } from "@/app/components/admin/AssistantPanel";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { PageHeader } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { isFullAccess } from "@/src/lib/system";
import { agentTools, aiAgentsEnabled } from "@/src/server/ai-core";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مساعد العمليات" };

const TOOL_LABELS: Record<string, { ar: string; en: string }> = {
  operations_today: { ar: "شغل اليوم", en: "Today's work" },
  automation_status: { ar: "حالة الأتمتة", en: "Automation status" },
  finance_facts: { ar: "أرقام المالية", en: "Finance figures" },
};

/**
 * Admin → Operations assistant (phase 5, step 2): ask a question, get an
 * answer read from the site's own numbers. Read-only; the switch, the role
 * checks and the audit live in src/server/ai-core.ts.
 */
export default async function AssistantPage() {
  const { user, allowed } = await requireStaffPage("/admin/assistant", "insights");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, enabled] = await Promise.all([getI18n(), aiAgentsEnabled()]);
  const configured = Boolean(process.env.ANTHROPIC_API_KEY);
  const tools = agentTools("operations", user.role);
  const isOwner = isFullAccess(user.role);
  const suggestions = [
    { ar: "شنو أهم شي لازم أسويه اليوم؟", en: "What should I do first today?" },
    { ar: "شكد طلب ينتظر تفعيل، ومن متى؟", en: "How many orders wait for activation, and since when?" },
    { ar: "الأتمتة اشتغلت اليوم بدون مشاكل؟", en: "Did the automation run without problems today?" },
    ...(tools.some((tool) => tool.name === "finance_facts") ? [{ ar: "شلون المبيعات هالشهر مقارنة بالشهر الماضي؟", en: "How are sales this month compared with last month?" }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("مساعد العمليات", "Operations assistant")}
        description={t(
          "اسأل عن شغل اليوم والطلبات والأتمتة، والمساعد يجاوبك من أرقام الموقع نفسها. يقرا بس: ما يغيّر شي ولا يراسل العملاء، وأسماء العملاء وأرقامهم ما توصله.",
          "Ask about today's work, orders and automation; the assistant answers from the site's own numbers. It only reads: it changes nothing, messages no one, and never sees customer names or numbers.",
        )}
        actions={
          isOwner ? (
            <LinkButton href="/admin/settings#ai" variant="ghost" size="sm">
              <Settings className="size-4" aria-hidden />
              {t("الإعدادات", "Settings")}
            </LinkButton>
          ) : null
        }
      />

      {!enabled ? (
        <Notice tone="warning" title={t("المساعد متوقف", "The assistant is off")}>
          {isOwner
            ? t("شغّل «مساعدي الذكاء الاصطناعي» من الإعدادات حتى تكدر تسأل.", "Switch on “AI assistants” in Settings to ask questions.")
            : t("المالك ما شغّل المساعد بعد.", "The owner hasn't switched the assistant on yet.")}
        </Notice>
      ) : !configured ? (
        <Notice tone="warning" title={t("الذكاء الاصطناعي غير مُعدّ", "AI is not configured")}>
          {t("مفتاح الذكاء الاصطناعي مو موجود على الخادم، فالمساعد ما يكدر يجاوب.", "The AI key is missing on the server, so the assistant can't answer.")}
        </Notice>
      ) : null}

      <AssistantPanel suggestions={suggestions} disabled={!enabled || !configured || !tools.length} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <span>{t("يقرا من:", "Reads from:")}</span>
        {tools.map((tool) => (
          <Badge key={tool.name} tone="neutral">
            {lang === "ar" ? TOOL_LABELS[tool.name]?.ar ?? tool.name : TOOL_LABELS[tool.name]?.en ?? tool.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
