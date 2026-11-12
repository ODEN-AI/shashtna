import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AssistantPanel } from "@/app/components/admin/AssistantPanel";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { PageHeader } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { LinkTabs } from "@/app/ui/Tabs";
import { AGENTS, TICKET_AGENTS, type AgentId } from "@/src/lib/ai-core";
import { isFullAccess } from "@/src/lib/system";
import { agentTools, aiAgentsEnabled } from "@/src/server/ai-core";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المساعدين" };

const TOOL_LABELS: Record<string, { ar: string; en: string }> = {
  operations_today: { ar: "شغل اليوم", en: "Today's work" },
  automation_status: { ar: "حالة الأتمتة", en: "Automation status" },
  finance_facts: { ar: "أرقام المالية", en: "Finance figures" },
  finance_trend: { ar: "اتجاه المبيعات", en: "Sales trend" },
};

/** Agents asked from this page; ticket agents (customer replies) live on the ticket page. */
type PageAgent = Exclude<AgentId, "customer">;

const AGENT_COPY: Record<PageAgent, { title: { ar: string; en: string }; description: { ar: string; en: string }; suggestions: { ar: string; en: string }[] }> = {
  operations: {
    title: { ar: "مساعد العمليات", en: "Operations assistant" },
    description: {
      ar: "اسأل عن شغل اليوم والطلبات والأتمتة، والمساعد يجاوبك من أرقام الموقع نفسها. يقرا بس: ما يغيّر شي ولا يراسل العملاء، وأسماء العملاء وأرقامهم ما توصله.",
      en: "Ask about today's work, orders and automation; the assistant answers from the site's own numbers. It only reads: it changes nothing, messages no one, and never sees customer names or numbers.",
    },
    suggestions: [
      { ar: "شنو أهم شي لازم أسويه اليوم؟", en: "What should I do first today?" },
      { ar: "شكد طلب ينتظر تفعيل، ومن متى؟", en: "How many orders wait for activation, and since when?" },
      { ar: "الأتمتة اشتغلت اليوم بدون مشاكل؟", en: "Did the automation run without problems today?" },
    ],
  },
  finance: {
    title: { ar: "مساعد المالية", en: "Finance assistant" },
    description: {
      ar: "اسأل عن الإيرادات والربح والباقات والخصومات، والمساعد يجاوبك من أرقام مجمّعة بس. للمالك والمدير. يقرا بس، وما يغيّر أي سعر أو خصم.",
      en: "Ask about revenue, profit, packages and discounts; the assistant answers from aggregate figures only. Owner and admins. It only reads and never changes a price or discount.",
    },
    suggestions: [
      { ar: "شلون المبيعات هالشهر مقارنة بالشهر الماضي؟", en: "How are sales this month compared with last month?" },
      { ar: "ليش الربح تغيّر هالشهر؟", en: "Why did profit change this month?" },
      { ar: "أي باقة تجيب أكثر إيراد؟", en: "Which package brings in the most revenue?" },
      { ar: "شلون المبيعات بآخر 12 شهر؟", en: "How have sales gone over the last 12 months?" },
      { ar: "الخصومات زادت المبيعات لو لا؟", en: "Did the discounts increase sales?" },
    ],
  },
};

/**
 * Admin → Assistants (phase 5): one tab per agent the role can use. Ask a
 * question, get an answer read from the site's own numbers. Read-only; the
 * switch, role checks and audit live in src/server/ai-core.ts.
 */
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { user, allowed } = await requireStaffPage("/admin/assistant", "insights");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, enabled, params] = await Promise.all([getI18n(), aiAgentsEnabled(), searchParams]);
  const available = AGENTS.filter((id): id is PageAgent => !TICKET_AGENTS.includes(id) && agentTools(id, user.role).length > 0);
  const agent: PageAgent = available.find((id) => id === params.agent) ?? available[0] ?? "operations";
  const configured = Boolean(process.env.ANTHROPIC_API_KEY);
  const tools = agentTools(agent, user.role);
  const isOwner = isFullAccess(user.role);
  const copy = AGENT_COPY[agent];
  const pick = (value: { ar: string; en: string }) => (lang === "ar" ? value.ar : value.en);

  return (
    <div className="space-y-6">
      <PageHeader
        title={pick(copy.title)}
        description={pick(copy.description)}
        actions={
          isOwner ? (
            <LinkButton href="/admin/settings#ai" variant="ghost" size="sm">
              <Settings className="size-4" aria-hidden />
              {t("الإعدادات", "Settings")}
            </LinkButton>
          ) : null
        }
      />

      {available.length > 1 ? (
        <LinkTabs label={t("المساعدين", "Assistants")} active={agent} tabs={available.map((id) => ({ key: id, href: `/admin/assistant?agent=${id}`, label: pick(AGENT_COPY[id].title) }))} />
      ) : null}

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

      <AssistantPanel key={agent} agent={agent} label={pick(copy.title)} suggestions={copy.suggestions} disabled={!enabled || !configured || !tools.length} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <span>{t("يقرا من:", "Reads from:")}</span>
        {tools.map((tool) => (
          <Badge key={tool.name} tone="neutral">
            {TOOL_LABELS[tool.name] ? pick(TOOL_LABELS[tool.name]) : tool.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
