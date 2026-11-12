import assert from "node:assert/strict";
import { test } from "node:test";

const c = await import("@/src/lib/ai-core");
const { settingProblem } = await import("@/src/lib/system");

const schema = {
  type: "object",
  properties: {
    period: { type: "string", enum: ["today", "month"] },
    days: { type: "integer", minimum: 1, maximum: 30 },
  },
  required: ["period"],
  additionalProperties: false,
} as const;

test("ai core: tool input is validated strictly", () => {
  assert.deepEqual(c.checkToolInput(schema, { period: "month" }), { ok: true, value: { period: "month" } });
  assert.deepEqual(c.checkToolInput(schema, { period: "today", days: 7 }), { ok: true, value: { period: "today", days: 7 } });
  assert.equal(c.checkToolInput(schema, {}).ok, false, "required field");
  assert.equal(c.checkToolInput(schema, { period: "year" }).ok, false, "enum");
  assert.equal(c.checkToolInput(schema, { period: "month", days: 0 }).ok, false, "range");
  assert.equal(c.checkToolInput(schema, { period: "month", days: 2.5 }).ok, false, "whole number");
  assert.equal(c.checkToolInput(schema, { period: "month", days: "7" }).ok, false, "type");
  assert.equal(c.checkToolInput(schema, { period: "month", userId: 3 }).ok, false, "unknown field");
  assert.equal(c.checkToolInput(schema, null).ok, false);
  assert.equal(c.checkToolInput(schema, ["month"]).ok, false);
});

test("ai core: tools follow role permissions and data classes", () => {
  const orders = { permission: "orders", dataClass: "OPERATIONAL" } as const;
  const finance = { permission: "finance", dataClass: "AGGREGATE" } as const;
  const customer = { permission: "customers", dataClass: "CUSTOMER" } as const;

  assert.equal(c.canUseTool("OWNER", finance), true);
  assert.equal(c.canUseTool("OPERATOR", orders), true);
  assert.equal(c.canUseTool("OPERATOR", finance), false, "money stays owner/admin");
  assert.equal(c.canUseTool("SUPPORT", orders), false);
  assert.equal(c.canUseTool("CUSTOMER", orders), false, "customers are never staff");
  assert.equal(c.canUseTool("OWNER", customer), false, "CUSTOMER data is off in step 1, even for the owner");
  assert.deepEqual(c.toolsFor("OPERATOR", [orders, finance]), [orders]);
});

test("ai core: results are masked before the model sees them", () => {
  const masked = c.maskForModel({
    orderId: 41,
    serviceName: "IPTV 6 أشهر",
    phone: "07701234567",
    customerName: "علي",
    name: "علي",
    note: "اتصل على 0770 123 4567 أو +9647701234567 أو ali@example.com",
    card: "رقم 1234567890123",
    nested: [{ email: "x@y.com", password: "secret", count: 3 }],
  }) as Record<string, unknown>;

  assert.equal(masked.orderId, 41);
  assert.equal(masked.serviceName, "IPTV 6 أشهر");
  assert.equal("phone" in masked, false);
  assert.equal("customerName" in masked, false);
  assert.equal("name" in masked, false);
  assert.doesNotMatch(String(masked.note), /0770|9647|example\.com/);
  assert.doesNotMatch(String(masked.card), /1234567890123/);
  assert.deepEqual(masked.nested, [{ count: 3 }]);
});

test("ai core: results are capped and marked when cut", () => {
  const text = c.toolResultText({ rows: "x".repeat(c.MAX_RESULT_CHARS * 2) });

  assert.ok(text.length <= c.MAX_RESULT_CHARS + 20);
  assert.match(text, /\[truncated\]$/);
  assert.equal(c.toolResultText({ a: 1 }), '{"a":1}');
});

test("ai core: a run is bounded in turns and tool calls", () => {
  assert.equal(c.canContinue({ turns: 0, toolCalls: 0 }), true);
  assert.equal(c.canContinue({ turns: c.MAX_TURNS, toolCalls: 0 }), false);
  assert.equal(c.canContinue({ turns: 1, toolCalls: c.MAX_TOOL_CALLS }), false);
  assert.equal(c.allowedCalls({ turns: 1, toolCalls: c.MAX_TOOL_CALLS - 2 }, 5), 2);
  assert.equal(c.allowedCalls({ turns: 1, toolCalls: c.MAX_TOOL_CALLS }, 3), 0);
});

test("ai core: questions are cleaned and capped", () => {
  assert.equal(c.cleanQuestion("   "), null);
  assert.equal(c.cleanQuestion(null), null);
  assert.equal(c.cleanQuestion("  شنو   أسوي  اليوم؟ "), "شنو أسوي اليوم؟");
  assert.equal(c.cleanQuestion("a".repeat(5000))?.length, c.MAX_QUESTION_CHARS);
});

test("ai core: names, agents and the audit summary", () => {
  assert.equal(c.isValidToolName("operations_today"), true);
  assert.equal(c.isValidToolName("Operations"), false);
  assert.equal(c.isValidToolName("x"), false);
  assert.equal(c.isAgentId("operations"), true);
  assert.equal(c.isAgentId("finance"), false, "only built agents are valid");
  assert.equal(c.traceSummary([]), "بدون أدوات");
  assert.equal(c.traceSummary([{ tool: "a", input: {}, ok: true, ms: 1 }, { tool: "b", input: null, ok: false, error: "x", ms: 1 }]), "a، b ✗");
});

test("ai core: the agents switch accepts on/off only", () => {
  assert.equal(settingProblem("ai.agents.enabled", "on"), null);
  assert.equal(settingProblem("ai.agents.enabled", "off"), null);
  assert.ok(settingProblem("ai.agents.enabled", "yes"));
});
