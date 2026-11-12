/**
 * Integration check of SHASHTNA AI CORE (phase 5, step 1) against a LOCAL
 * database, with a scripted stand-in for the model (no API key, no network):
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/ai-core.mts
 *
 * The tool loop runs real read-only tools on the local data; a role only gets
 * the tools it may use and a forbidden or malformed call is refused; results
 * reach the model masked; runs are bounded; the switch is honoured; and the
 * activity log never holds the question or any tool result.
 * Refuses any non-local DATABASE_URL. Creates only activity rows.
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
const { runAgent, agentTools } = await import("@/src/server/ai-core");
const { MAX_TOOL_CALLS } = await import("@/src/lib/ai-core");

type Turn = { stopReason: string | null; content: unknown[]; model: string };
type Seen = { tools: string[]; messages: unknown[] };

/** A scripted model: returns the given turns in order and records what it was sent. */
const scripted = (turns: Turn[], seen: Seen[] = []) => {
  let index = 0;

  return {
    seen,
    callModel: async (input: { tools: { name: string }[]; messages: unknown[] }) => {
      seen.push({ tools: input.tools.map((tool) => tool.name), messages: JSON.parse(JSON.stringify(input.messages)) });
      const turn = turns[Math.min(index, turns.length - 1)];
      index += 1;

      return turn as never;
    },
  };
};
const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });
const text = (value: string) => ({ type: "text", text: value });
const lastToolResults = (seen: Seen[]) => {
  const last = seen[seen.length - 1].messages as { role: string; content: unknown }[];

  return last[last.length - 1].content as { tool_use_id: string; content: string; is_error?: boolean }[];
};

const owner = (await db.orm.public.User.where((u) => u.role.in(["OWNER", "ADMIN"])).first()) ?? null;
const start = new Date(Date.now() - 1000).toISOString();
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).replace(/\s*\n\s*/g, " ").slice(0, 300)}`);
  }
};

assert.ok(owner, "the local database needs an OWNER or ADMIN user");
const ownerActor = { id: owner!.id, role: owner!.role };
const operator = { id: owner!.id, role: "OPERATOR" };
const QUESTION = "شنو أهم شي لازم أسويه اليوم؟ رقمي 07701234567";

await check("owner: real tools run, the answer comes back, results are masked JSON", async () => {
  const model = scripted([
    { stopReason: "tool_use", model: "fake", content: [toolUse("t1", "operations_today", {}), toolUse("t2", "finance_facts", { period: "month" })] },
    { stopReason: "end_turn", model: "fake", content: [text("ابدأ بالطلبات المدفوعة اللي ما تفعّلت.")] },
  ]);
  const result = await runAgent(ownerActor, "operations", QUESTION, { callModel: model.callModel, skipSwitch: true });

  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.answer, "ابدأ بالطلبات المدفوعة اللي ما تفعّلت.");
  assert.deepEqual(result.trace.map((call) => [call.tool, call.ok]), [["operations_today", true], ["finance_facts", true]]);
  assert.deepEqual(model.seen[0].tools.sort(), ["automation_status", "finance_facts", "operations_today"]);

  const toolResults = lastToolResults(model.seen);
  assert.equal(toolResults.length, 2, "both results in ONE user message");
  for (const item of toolResults) {
    assert.equal(item.is_error, undefined);
    JSON.parse(item.content);
    assert.doesNotMatch(item.content, /07\d{9}|@[\w-]+\.\w+|"phone"|"customerName"/);
  }
});

await check("operator: finance is never offered, and a call to it anyway is refused", async () => {
  assert.deepEqual(agentTools("operations", "OPERATOR").map((tool) => tool.name).sort(), ["automation_status", "operations_today"]);
  assert.equal(agentTools("operations", "CONTENT").length, 0);

  const model = scripted([
    { stopReason: "tool_use", model: "fake", content: [toolUse("t1", "finance_facts", { period: "month" })] },
    { stopReason: "end_turn", model: "fake", content: [text("ما أكدر أشوف المالية.")] },
  ]);
  const result = await runAgent(operator, "operations", "شكد الربح؟", { callModel: model.callModel, skipSwitch: true });

  assert.equal(result.ok, true);
  assert.equal(model.seen[0].tools.includes("finance_facts"), false);
  const [refused] = lastToolResults(model.seen);
  assert.equal(refused.is_error, true);
  assert.match(refused.content, /not available/);
});

await check("a role with no tools is refused before any model call", async () => {
  const model = scripted([{ stopReason: "end_turn", model: "fake", content: [text("x")] }]);
  const result = await runAgent({ id: owner!.id, role: "CONTENT" }, "operations", "هلو", { callModel: model.callModel, skipSwitch: true });

  assert.equal(result.ok, false);
  assert.equal(model.seen.length, 0);
  assert.equal((await runAgent({ id: owner!.id, role: "CUSTOMER" }, "operations", "هلو", { callModel: model.callModel, skipSwitch: true })).ok, false, "customers are not staff");
});

await check("malformed tool input is refused, never passed to the tool", async () => {
  const model = scripted([
    { stopReason: "tool_use", model: "fake", content: [toolUse("t1", "finance_facts", { period: "forever" }), toolUse("t2", "finance_facts", { period: "month", userId: 5 })] },
    { stopReason: "end_turn", model: "fake", content: [text("تمام")] },
  ]);
  const result = await runAgent(ownerActor, "operations", "شكد الربح؟", { callModel: model.callModel, skipSwitch: true });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.trace.map((call) => call.ok), [false, false]);
  assert.ok(lastToolResults(model.seen).every((item) => item.is_error));
});

await check("a run is bounded: endless tool calls stop at the limit with an answer", async () => {
  const model = scripted([{ stopReason: "tool_use", model: "fake", content: [toolUse("t", "automation_status", {}), toolUse("u", "automation_status", {}), toolUse("v", "automation_status", {})] }]);
  const result = await runAgent(ownerActor, "operations", "كرر", { callModel: model.callModel, skipSwitch: true });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.stopped, "LIMIT");
  assert.ok(result.answer.length > 0);
  assert.ok(result.trace.filter((call) => call.ok).length <= MAX_TOOL_CALLS);
});

await check("refusal and model errors end the run cleanly", async () => {
  const refused = await runAgent(ownerActor, "operations", "x", { callModel: scripted([{ stopReason: "refusal", model: "fake", content: [] }]).callModel, skipSwitch: true });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.reason, "REFUSED");

  const broken = await runAgent(ownerActor, "operations", "x", {
    callModel: async () => {
      throw new Error("network down");
    },
    skipSwitch: true,
  });
  assert.equal(broken.ok, false);
  if (!broken.ok) assert.equal(broken.reason, "MODEL_ERROR");
});

await check("the switch: off by default, a run is refused without calling the model", async () => {
  const setting = await db.orm.public.SiteSetting.first({ key: "ai.agents.enabled" });
  assert.notEqual(setting?.value, "on", "this check expects the local switch to be off");

  const model = scripted([{ stopReason: "end_turn", model: "fake", content: [text("x")] }]);
  const result = await runAgent(ownerActor, "operations", "هلو", { callModel: model.callModel });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "OFF");
  assert.equal(model.seen.length, 0);
});

await check("finance agent: owner gets both finance tools and the trend runs; other roles are refused", async () => {
  assert.deepEqual(agentTools("finance", "OWNER").map((tool) => tool.name).sort(), ["finance_facts", "finance_trend"]);
  assert.equal(agentTools("finance", "OPERATOR").length, 0, "money stays owner/admin");

  const model = scripted([
    { stopReason: "tool_use", model: "fake", content: [toolUse("t1", "finance_trend", { view: "month" }), toolUse("t2", "operations_today", {})] },
    { stopReason: "end_turn", model: "fake", content: [text("المبيعات ثابتة.")] },
  ]);
  const result = await runAgent(ownerActor, "finance", "شلون المبيعات؟", { callModel: model.callModel, skipSwitch: true });

  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.deepEqual(result.trace.map((call) => [call.tool, call.ok]), [["finance_trend", true], ["operations_today", false]], "a tool of another agent is not available here");
  const [trend] = lastToolResults(model.seen);
  const parsed = JSON.parse(trend.content) as { currency: string; points: { key: string; revenue: number }[] };
  assert.equal(parsed.currency, "IQD");
  assert.equal(parsed.points.length, 12, "12 monthly points");

  const refused = await runAgent(operator, "finance", "شكد الربح؟", { callModel: model.callModel, skipSwitch: true });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.reason, "FORBIDDEN");
});

await check("bad requests: unknown agent, empty question", async () => {
  assert.equal((await runAgent(ownerActor, "marketing", "x", { skipSwitch: true })).ok, false);
  assert.equal((await runAgent(ownerActor, "operations", "   ", { skipSwitch: true })).ok, false);
});

await check("the activity log keeps tool names, never the question or the data", async () => {
  const rows = await db.orm.public.ActivityEvent.where((e) => e.action.in(["AI_AGENT_RUN", "AI_AGENT_FAILED"])).where((e) => e.createdAt.gte(start)).all();

  assert.ok(rows.length >= 7, `expected the runs above to be logged, got ${rows.length}`);
  for (const row of rows) {
    const blob = `${row.summary} ${row.details ?? ""}`;
    assert.doesNotMatch(blob, /07701234567|أهم شي|revenue|subscriptionsToContact/);
  }
});

// Remove the activity rows this script created.
await db.orm.public.ActivityEvent.where((e) => e.action.in(["AI_AGENT_RUN", "AI_AGENT_FAILED"])).where((e) => e.createdAt.gte(start)).delete();

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
