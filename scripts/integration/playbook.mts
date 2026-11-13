/**
 * Integration check of the owner's playbook (phase 5) against a LOCAL database:
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/integration/playbook.mts
 *
 * Only the owner/admin can add or edit entries (audited), bad input is refused,
 * disabled entries never reach the agent, and the customer agent's
 * playbook_search tool returns the owner's answer for a customer's words.
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
const { savePlaybookEntry, findPlaybook, listPlaybook } = await import("@/src/server/playbook");
const { runAgent } = await import("@/src/server/ai-core");
const { saveSupportTicket } = await import("@/src/lib/support-store");
const { readFile, writeFile } = await import("node:fs/promises");
const path = await import("node:path");

const R = Date.now().toString(36).toUpperCase();
const start = new Date(Date.now() - 1000).toISOString();
const owner = await db.orm.public.User.where((u) => u.role.in(["OWNER", "ADMIN"])).first();
assert.ok(owner, "the local database needs an OWNER or ADMIN user");
const ownerActor = { id: owner!.id, role: owner!.role };
const created: number[] = [];
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String((error as Error).message).replace(/\s*\n\s*/g, " ").slice(0, 300)}`);
  }
};
const entry = (extra: Record<string, unknown>) => ({
  kind: "PROBLEM",
  service: "IPTV",
  title: `تقطيع القنوات ${R}`,
  keywords: `تقطيع، توكف، zz${R}`,
  content: "أعد تشغيل الراوتر دقيقة، وبعدين افتح التطبيق من جديد.",
  sortOrder: "0",
  isActive: "on",
  ...extra,
});

await check("only the owner/admin can add or edit; bad input refused; changes audited", async () => {
  const denied = await savePlaybookEntry({ id: owner!.id, role: "SUPPORT" }, null, entry({}));
  assert.equal(denied.ok, false);

  const bad = await savePlaybookEntry(ownerActor, null, entry({ kind: "NOPE" }));
  assert.equal(bad.ok, false);

  const ok = await savePlaybookEntry(ownerActor, null, entry({}));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  if (ok.ok) created.push(ok.id);

  const off = await savePlaybookEntry(ownerActor, null, entry({ title: `قديم ${R}`, isActive: "off" }));
  if (off.ok) created.push(off.id);

  if (ok.ok) assert.equal((await savePlaybookEntry(ownerActor, ok.id, entry({ content: "أعد تشغيل الراوتر دقيقتين، وبعدين افتح التطبيق." }))).ok, true);

  const audit = await db.orm.public.ActivityEvent.where((e) => e.action.in(["PLAYBOOK_CREATED", "PLAYBOOK_UPDATED"])).where((e) => e.createdAt.gte(start)).all();
  assert.equal(audit.length, 3);
});

await check("search finds the owner's fix by the customer's words; disabled entries never show", async () => {
  const found = await findPlaybook(`القنوات دا توكف zz${R}`, { service: "IPTV" });
  const mine = found.find((row) => row.title === `تقطيع القنوات ${R}`);

  assert.ok(mine, "the entry is found");
  assert.equal(found.some((row) => row.title === `قديم ${R}`), false);
  assert.match(mine!.content, /دقيقتين/, "the edited text is used");
  assert.equal((await findPlaybook(`zz${R}`, { service: "VIP" })).some((row) => row.title.endsWith(R)), false, "an IPTV entry is not offered for VIP");
  assert.ok((await listPlaybook()).some((row) => row.title === `قديم ${R}`), "the admin list keeps disabled entries");
});

await check("the customer agent's playbook_search tool returns the entry; bad queries are refused", async () => {
  const ticketId = `ST-PBTEST-${R}`;
  const now = new Date().toISOString();

  await saveSupportTicket({
    id: ticketId,
    userId: owner!.id,
    userName: "x",
    userPhone: "x",
    subject: "توكف",
    category: "technical",
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
    lastSender: "CUSTOMER",
    messages: [{ id: `m-${R}`, sender: "CUSTOMER", senderName: null, message: "القنوات توكف", createdAt: now }],
  });

  try {
    const seen: unknown[] = [];
    const turns = [
      {
        stopReason: "tool_use",
        model: "fake",
        content: [
          { type: "tool_use", id: "a", name: "playbook_search", input: { query: `توكف zz${R}`, service: "IPTV" } },
          { type: "tool_use", id: "b", name: "playbook_search", input: { query: "   ", service: "IPTV" } },
        ],
      },
      { stopReason: "end_turn", model: "fake", content: [{ type: "text", text: "جرّب تعيد تشغيل الراوتر." }] },
    ];
    let index = 0;
    const result = await runAgent({ id: owner!.id, role: "SUPPORT" }, "customer", "اكتب مسودة", {
      skipSwitch: true,
      scope: { ticketId },
      callModel: async (input) => {
        seen.push(JSON.parse(JSON.stringify(input.messages)));
        const turn = turns[Math.min(index, turns.length - 1)];
        index += 1;
        return turn as never;
      },
    });

    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.deepEqual(result.trace.map((call) => [call.tool, call.ok]), [["playbook_search", true], ["playbook_search", false]]);
    const last = seen[seen.length - 1] as { content: { content: string }[] }[];
    assert.match(last[last.length - 1].content[0].content, /دقيقتين/);
  } finally {
    const file = path.join(process.cwd(), ".data", "support-tickets.json");
    const tickets = JSON.parse(await readFile(file, "utf8")) as { id: string }[];
    await writeFile(file, JSON.stringify(tickets.filter((item) => item.id !== ticketId), null, 2), "utf8");
  }
});

// Clean up: the rows and audit entries this script created.
for (const id of created) await db.orm.public.PlaybookEntry.where({ id }).delete();
await db.orm.public.ActivityEvent.where((e) => e.action.in(["PLAYBOOK_CREATED", "PLAYBOOK_UPDATED", "AI_AGENT_RUN", "AI_AGENT_FAILED"])).where((e) => e.createdAt.gte(start)).delete();

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
