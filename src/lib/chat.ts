import { maskForModel } from "@/src/lib/ai-core";

/**
 * Site chat with the AI customer agent — pure rules (phase 5, customer agent
 * phase B). See docs/site-chat.md.
 *
 * A customer talks to the agent in My Shashtna. The agent answers from the
 * owner's playbook and the customer's own service status. When it can't help
 * (or the customer is unhappy, asks for a refund, or says they paid), it hands
 * the conversation over to staff and goes silent until staff hand it back.
 */

export const CHAT_STATUSES = ["AI", "HANDOVER", "CLOSED"] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number];

export const CHAT_SENDERS = ["CUSTOMER", "AI", "STAFF"] as const;
export type ChatSender = (typeof CHAT_SENDERS)[number];

export const CHAT_HANDOVER_REASONS = ["NOT_IN_PLAYBOOK", "UNHAPPY", "REFUND", "PAYMENT", "ASKED_FOR_HUMAN", "LIMIT", "OTHER"] as const;
export type ChatHandoverReason = (typeof CHAT_HANDOVER_REASONS)[number];

export const CHAT_HANDOVER_LABELS: Record<ChatHandoverReason, { ar: string; en: string }> = {
  NOT_IN_PLAYBOOK: { ar: "مو موجود بالدليل", en: "Not in the playbook" },
  UNHAPPY: { ar: "الزبون مو راضي", en: "Customer unhappy" },
  REFUND: { ar: "يطلب استرجاع", en: "Refund request" },
  PAYMENT: { ar: "يكول دفع", en: "Says they paid" },
  ASKED_FOR_HUMAN: { ar: "طلب موظف", en: "Asked for a person" },
  LIMIT: { ar: "وصل حد الرسائل", en: "Message limit reached" },
  OTHER: { ar: "سبب ثاني", en: "Other" },
};

export const CHAT_STATUS_LABELS: Record<ChatStatus, { ar: string; en: string }> = {
  AI: { ar: "المساعد يرد", en: "Assistant replying" },
  HANDOVER: { ar: "بانتظار الفريق", en: "Waiting for the team" },
  CLOSED: { ar: "مغلقة", en: "Closed" },
};

export const CHAT_LIMITS = {
  /** One message from the customer or staff. */
  messageChars: 1000,
  /** The agent's note to staff when it hands over. */
  noteChars: 200,
  /** Customer messages the agent answers per customer per Baghdad day; then it hands over. */
  aiRepliesPerDay: 25,
  /** Most recent messages sent to the model as the conversation. */
  historyMessages: 20,
} as const;

export function isChatStatus(value: unknown): value is ChatStatus {
  return typeof value === "string" && (CHAT_STATUSES as readonly string[]).includes(value);
}

export function isHandoverReason(value: unknown): value is ChatHandoverReason {
  return typeof value === "string" && (CHAT_HANDOVER_REASONS as readonly string[]).includes(value);
}

/** A message as typed: trimmed, inner whitespace kept (line breaks matter), never empty, capped. */
export function cleanChatMessage(value: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return { ok: false, error: "اكتب رسالتك." };
  if (text.length > CHAT_LIMITS.messageChars) return { ok: false, error: `الرسالة طويلة. الحد ${CHAT_LIMITS.messageChars} حرف.` };

  return { ok: true, text };
}

/** Whether the agent should answer a new customer message now. */
export function agentShouldReply(status: string, repliesToday: number) {
  if (status !== "AI") return { reply: false as const, handover: null };
  if (repliesToday >= CHAT_LIMITS.aiRepliesPerDay) return { reply: false as const, handover: "LIMIT" as const };

  return { reply: true as const, handover: null };
}

export type StoredChatMessage = { sender: string; body: string };
export type ModelChatMessage = { role: "user" | "assistant"; content: string };

/**
 * The stored conversation as the model sees it: the last N messages, masked
 * (phones, e-mails), customer → user, agent → assistant, staff → assistant
 * marked as the team. Starts with a customer message (the API requires a user
 * turn first); same-role neighbours are merged.
 */
export function chatHistoryForModel(messages: readonly StoredChatMessage[], limit: number = CHAT_LIMITS.historyMessages): ModelChatMessage[] {
  const recent = messages.slice(-limit);
  const first = recent.findIndex((message) => message.sender === "CUSTOMER");

  if (first === -1) return [];

  const out: ModelChatMessage[] = [];

  for (const message of recent.slice(first)) {
    const masked = String(maskForModel(message.body));
    const role = message.sender === "CUSTOMER" ? "user" : "assistant";
    const content = message.sender === "STAFF" ? `[رد من فريق شاشتنا] ${masked}` : masked;
    const last = out[out.length - 1];

    if (last && last.role === role) last.content = `${last.content}\n\n${content}`;
    else out.push({ role, content });
  }

  return out;
}
