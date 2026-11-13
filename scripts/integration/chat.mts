/**
 * Integration check of the AI site chat (phase 5, customer agent phase B)
 * against a LOCAL database, with a scripted model (no API calls):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/chat.mts
 *
 * The switch and roles are enforced; the agent's tools see only the chatting
 * customer, masked; hand_over silences the agent until staff hand back; a
 * model failure hands over with an apology; the daily limit hands over
 * without a model call; the audit log never holds the text.
 * Refuses any non-local DATABASE_URL. Removes the rows it creates.
 */
import assert from "node:assert/strict";

await import("dotenv/config");

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

if (host !== "localhost" && host !== "127.0.0.1") {
  console.error("Refusing to run: DATABASE_URL must point at a local database.");
  process.exit(2);
}

const { db } = await import("@/src/prisma/db");
const chat = await import("@/src/server/chat");

type Turn = { stopReason: string; model: string; content: unknown[] };

const start = new Date(Date.now() - 1000).toISOString();
const customerRow = await db.orm.public.User.where({ role: "CUSTOMER" }).first();
const staffRow = await db.orm.public.User.where((u) => u.role.in(["OWNER", "ADMIN"])).first();
assert.ok(customerRow && staffRow, "the local database needs a CUSTOMER and an OWNER/ADMIN user");
const customer = { id: customerRow!.id, role: "CUSTOMER" };
const staff = { id: staffRow!.id, role: staffRow!.role };
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).replace(/\s*\n\s*/g, " ").slice(0, 300)}`);
  }
};
const scripted = (turns: Turn[]) => {
  const seen: unknown[] = [];
  let index = 0;

  return {
    seen,
    calls: () => index,
    callModel: async (input: { messages: unknown[] }) => {
      seen.push(JSON.parse(JSON.stringify(input.messages)));
      const turn = turns[Math.min(index, turns.length - 1)];
      index += 1;
      return turn as never;
    },
  };
};
const toolUse = (id: string, name: string, input: Record<string, unknown>) => ({ type: "tool_use", id, name, input });
const text = (value: string) => ({ type: "text", text: value });
const lastToolResults = (seen: unknown[]) => {
  const messages = seen[seen.length - 1] as { role: string; content: unknown }[];

  return messages[messages.length - 1].content as { content: string; is_error?: boolean }[];
};

// Start from no open chat for this customer (earlier runs leave none; be safe).
await db.orm.public.ChatConversation.where({ userId: customer.id }).where((c) => c.status.neq("CLOSED")).update({ status: "CLOSED" });

await check("the switch and roles: off refuses without storing; staff can't chat as customers", async () => {
  const off = await chat.sendCustomerMessage(customer, "هلا", { callModel: scripted([]).callModel });
  assert.equal(off.ok, false);
  if (!off.ok) assert.equal(off.code, "OFF");
  assert.equal(await chat.getCustomerChat(customer.id), null, "nothing stored while off");

  const asStaff = await chat.sendCustomerMessage(staff, "هلا", { callModel: scripted([]).callModel, skipSwitch: true });
  assert.equal(asStaff.ok, false);

  const empty = await chat.sendCustomerMessage(customer, "   ", { callModel: scripted([]).callModel, skipSwitch: true });
  assert.equal(empty.ok, false);
});

await check("the agent answers with the customer's own services, masked; contacts never reach the model", async () => {
  const model = scripted([
    { stopReason: "tool_use", model: "fake", content: [toolUse("a", "my_services", {}), toolUse("b", "read_playbook", { service: "IPTV" })] },
    { stopReason: "end_turn", model: "fake", content: [text("جرّب تعيد تشغيل الراوتر.")] },
  ]);
  const sent = await chat.sendCustomerMessage(customer, "القنوات توكف، رقمي 07701234567", { callModel: model.callModel, skipSwitch: true });

  assert.equal(sent.ok, true, JSON.stringify(sent));
  if (!sent.ok) return;
  assert.equal(sent.replied, true);
  assert.equal(sent.handedOver, false);

  const first = JSON.stringify(model.seen[0]);
  assert.doesNotMatch(first, /07701234567/, "the customer's phone is masked before the model");

  const [services] = lastToolResults(model.seen);
  assert.doesNotMatch(services.content, /"username"|"password"|accountEmail|macAddress|deviceId|paymentReference|customerNote/);

  const ownOrders = (await db.orm.public.SubscriptionRequest.where({ userId: customer.id }).all()).map((o) => o.id);
  const shown = (JSON.parse(services.content) as { orders: { number: string }[] }).orders.map((o) => Number(o.number.replace(/\D/g, "")));
  assert.ok(shown.every((n) => ownOrders.includes(n)), "only this customer's orders");

  const stored = await chat.getCustomerChat(customer.id);
  assert.deepEqual(stored?.messages.map((m) => m.sender), ["CUSTOMER", "AI"]);
  assert.equal(stored?.conversation.status, "AI");
});

await check("hand_over silences the agent; staff reply notifies; hand back resumes the agent", async () => {
  const model = scripted([
    { stopReason: "tool_use", model: "fake", content: [toolUse("h", "hand_over", { reason: "PAYMENT", note: "يكول حوّل لطلب #12" })] },
    { stopReason: "end_turn", model: "fake", content: [text("تمام، حوّلتك للفريق وراح يردون هنا.")] },
  ]);
  const paid = await chat.sendCustomerMessage(customer, "حوّلت الفلوس", { callModel: model.callModel, skipSwitch: true });

  assert.equal(paid.ok && paid.handedOver, true);
  const after = await chat.getCustomerChat(customer.id);
  assert.equal(after?.conversation.status, "HANDOVER");
  assert.equal(after?.conversation.handoverReason, "PAYMENT");
  assert.ok((await chat.countWaitingChats()) >= 1, "the inbox badge counts it");

  const silent = scripted([{ stopReason: "end_turn", model: "fake", content: [text("should not run")] }]);
  const waiting = await chat.sendCustomerMessage(customer, "وينكم؟", { callModel: silent.callModel, skipSwitch: true });
  assert.equal(waiting.ok && waiting.replied, false);
  assert.equal(silent.calls(), 0, "no model call while handed over");

  const id = after!.conversation.id;
  assert.equal((await chat.staffReply(staff, id, "   ")).ok, false);
  assert.equal((await chat.staffReply(staff, id, "وصلت الحوالة، فعّلنا اشتراكك.", "handBack")).ok, true);
  const note = await db.orm.public.Notification.where({ userId: customer.id, type: "CHAT_REPLY" }).where((n) => n.createdAt.gte(start)).all();
  assert.ok(note.length >= 1, "the customer is notified");
  assert.equal((await chat.getCustomerChat(customer.id))?.conversation.status, "AI");

  // The staff message reaches the model marked as the team.
  const resumed = scripted([{ stopReason: "end_turn", model: "fake", content: [text("العفو!")] }]);
  await chat.sendCustomerMessage(customer, "شكرًا", { callModel: resumed.callModel, skipSwitch: true });
  assert.match(JSON.stringify(resumed.seen[0]), /رد من فريق شاشتنا/);
});

await check("a model failure hands over with an apology; the agent never invents a reply", async () => {
  const broken = { callModel: async () => { throw new Error("network down"); } };
  const sent = await chat.sendCustomerMessage(customer, "سؤال", { callModel: broken.callModel as never, skipSwitch: true });

  assert.equal(sent.ok && sent.handedOver, true);
  const after = await chat.getCustomerChat(customer.id);
  assert.match(after!.messages[after!.messages.length - 1].body, /حوّلت محادثتك/);
  assert.equal(after?.conversation.handoverReason, "OTHER");
  assert.equal((await chat.setChatStatus(staff, after!.conversation.id, "AI")).ok, true);
});

await check("the daily limit hands over without calling the model", async () => {
  const current = await chat.getCustomerChat(customer.id);
  const id = current!.conversation.id;
  const already = await db.orm.public.ChatMessage.where((m) => m.conversationId.in([id])).where({ sender: "AI" }).aggregate((a) => ({ count: a.count() }));

  for (let i = already.count; i < 25; i += 1) await db.orm.public.ChatMessage.create({ conversationId: id, sender: "AI", body: "filler" });

  const model = scripted([{ stopReason: "end_turn", model: "fake", content: [text("should not run")] }]);
  const sent = await chat.sendCustomerMessage(customer, "سؤال ثاني", { callModel: model.callModel, skipSwitch: true });

  assert.equal(sent.ok && sent.handedOver, true);
  assert.equal(model.calls(), 0);
  assert.equal((await chat.getCustomerChat(customer.id))?.conversation.handoverReason, "LIMIT");
});

await check("the audit log keeps tools and outcomes, never the messages", async () => {
  const rows = await db.orm.public.ActivityEvent.where((e) => e.action.in(["CHAT_AI_REPLY", "CHAT_HANDOVER", "CHAT_STAFF_REPLY", "CHAT_STATUS"])).where((e) => e.createdAt.gte(start)).all();
  const blob = rows.map((row) => `${row.summary} ${row.details ?? ""}`).join(" ");

  assert.ok(rows.length >= 5, `expected chat runs to be logged, got ${rows.length}`);
  assert.doesNotMatch(blob, /07701234567|القنوات توكف|حوّلت الفلوس|وصلت الحوالة|الراوتر/);
});

// Clean up everything this script created.
const mine = await db.orm.public.ChatConversation.where({ userId: customer.id }).where((c) => c.createdAt.gte(start)).all();
for (const row of mine) {
  await db.orm.public.ChatMessage.where({ conversationId: row.id }).delete();
  await db.orm.public.ChatConversation.where({ id: row.id }).delete();
}
await db.orm.public.Notification.where({ userId: customer.id, type: "CHAT_REPLY" }).where((n) => n.createdAt.gte(start)).delete();
await db.orm.public.ActivityEvent.where((e) => e.action.in(["CHAT_AI_REPLY", "CHAT_HANDOVER", "CHAT_STAFF_REPLY", "CHAT_STATUS"])).where((e) => e.createdAt.gte(start)).delete();

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
