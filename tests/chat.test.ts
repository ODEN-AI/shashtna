import assert from "node:assert/strict";
import { test } from "node:test";

const c = await import("@/src/lib/chat");

test("chat: messages are trimmed, keep line breaks, and are capped", () => {
  assert.deepEqual(c.cleanChatMessage("  هلا   بيك \r\n\r\n\r\n\r\nشلونك  "), { ok: true, text: "هلا بيك \n\nشلونك" });
  assert.equal(c.cleanChatMessage("   ").ok, false);
  assert.equal(c.cleanChatMessage(null).ok, false);
  assert.equal(c.cleanChatMessage("x".repeat(c.CHAT_LIMITS.messageChars + 1)).ok, false);
  const bad = c.cleanChatMessage("");
  if (!bad.ok) assert.match(bad.error, /[؀-ۿ]/);
});

test("chat: the agent replies only while the chat is with it, and only up to the daily limit", () => {
  assert.deepEqual(c.agentShouldReply("AI", 0), { reply: true, handover: null });
  assert.deepEqual(c.agentShouldReply("HANDOVER", 0), { reply: false, handover: null });
  assert.deepEqual(c.agentShouldReply("CLOSED", 0), { reply: false, handover: null });
  assert.deepEqual(c.agentShouldReply("AI", c.CHAT_LIMITS.aiRepliesPerDay), { reply: false, handover: "LIMIT" });
  assert.deepEqual(c.agentShouldReply("AI", c.CHAT_LIMITS.aiRepliesPerDay - 1), { reply: true, handover: null });
});

test("chat: history for the model starts with the customer, merges neighbours, marks staff, masks contacts", () => {
  const history = c.chatHistoryForModel([
    { sender: "AI", body: "orphan reply before any customer message" },
    { sender: "CUSTOMER", body: "رقمي 07701234567 وايميلي a.b@example.com" },
    { sender: "CUSTOMER", body: "ساعدوني" },
    { sender: "AI", body: "تمام" },
    { sender: "STAFF", body: "هلا، شفنا طلبك" },
  ]);

  assert.equal(history.length, 2);
  assert.equal(history[0].role, "user");
  assert.doesNotMatch(history[0].content, /07701234567|example\.com/);
  assert.match(history[0].content, /ساعدوني/);
  assert.equal(history[1].role, "assistant");
  assert.match(history[1].content, /\[رد من فريق شاشتنا\] هلا/);
});

test("chat: history keeps only the last N messages and is empty without a customer message", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ sender: i % 2 ? "AI" : "CUSTOMER", body: `m${i}` }));
  const history = c.chatHistoryForModel(many, 10);

  assert.equal(history[0].content, "m20");
  assert.equal(history.length, 10);
  assert.deepEqual(c.chatHistoryForModel([{ sender: "AI", body: "x" }]), []);
});

test("chat: statuses and handover reasons are closed sets with labels", () => {
  assert.equal(c.isChatStatus("AI"), true);
  assert.equal(c.isChatStatus("OPEN"), false);
  assert.equal(c.isHandoverReason("PAYMENT"), true);
  assert.equal(c.isHandoverReason("x"), false);
  for (const reason of c.CHAT_HANDOVER_REASONS) assert.ok(c.CHAT_HANDOVER_LABELS[reason].ar);
  for (const status of c.CHAT_STATUSES) assert.ok(c.CHAT_STATUS_LABELS[status].ar);
});
