import assert from "node:assert/strict";
import { test } from "node:test";

const intel = await import("@/src/lib/intelligence");
const analyst = await import("@/src/lib/analyst");
const time = await import("@/src/lib/business-time");

type Pack = import("@/src/lib/intelligence").IntelligencePack;

const iso = (value: Date) => value.toISOString();
const DAY = 86_400_000;

// ------------------------------------------------------------------ date ranges

test("rolling presets: the last N Baghdad days vs the N days right before", () => {
  // 2026-09-15 10:00 Baghdad = 07:00 UTC
  const now = new Date("2026-09-15T07:00:00Z");
  for (const [key, days] of [["last7", 7], ["last30", 30], ["last90", 90]] as const) {
    const { current, previous } = time.resolveRange(key, now);
    assert.equal(time.businessDay(current.start), time.businessDay(new Date(now.getTime() - (days - 1) * DAY)), key);
    assert.equal(iso(current.start).slice(11, 16), "21:00", "starts at Baghdad midnight (21:00 UTC)");
    assert.equal(current.end.getTime(), now.getTime() + 1);
    assert.equal(previous.end.getTime(), current.start.getTime(), "contiguous");
    assert.equal(previous.end.getTime() - previous.start.getTime(), current.end.getTime() - current.start.getTime(), "same length");
  }
});

test("previous month = the whole previous calendar month vs the one before it", () => {
  const { current, previous } = time.resolveRange("prevMonth", new Date("2026-03-10T07:00:00Z"));
  assert.equal(time.businessDay(current.start), "2026-02-01");
  assert.equal(time.businessDay(new Date(current.end.getTime() - 1)), "2026-02-28");
  assert.equal(time.businessDay(previous.start), "2026-01-01");
  assert.equal(previous.end.getTime(), current.start.getTime());
  // Across a year boundary.
  const jan = time.resolveRange("prevMonth", new Date("2026-01-05T07:00:00Z"));
  assert.equal(time.businessDay(jan.current.start), "2025-12-01");
  assert.equal(time.businessDay(jan.previous.start), "2025-11-01");
});

test("the existing presets are unchanged", () => {
  const now = new Date("2026-09-15T07:00:00Z");
  const month = time.resolveRange("month", now);
  assert.equal(time.businessDay(month.current.start), "2026-09-01");
  assert.equal(time.businessDay(month.previous.start), "2026-08-01");
  const custom = time.resolveRange("custom", now, { from: "2026-09-01", to: "2026-09-10" });
  assert.equal(custom.previous.end.getTime(), custom.current.start.getTime());
});

// ------------------------------------------------------------------ comparisons

test("percentage change: null with no base, never Infinity or NaN", () => {
  assert.deepEqual(intel.compare(140, 100), { current: 140, previous: 100, abs: 40, pct: 40 });
  assert.deepEqual(intel.compare(5, 0), { current: 5, previous: 0, abs: 5, pct: null });
  assert.deepEqual(intel.compare(0, 0), { current: 0, previous: 0, abs: 0, pct: null });
  assert.deepEqual(intel.compare(0, 4), { current: 0, previous: 4, abs: -4, pct: -100 });
  assert.equal(intel.compare(1, 3).pct, -66.7);
  const weird = intel.compare(Number.NaN, Number.POSITIVE_INFINITY);
  assert.ok(Number.isFinite(weird.current) && Number.isFinite(weird.previous) && weird.pct === null);
});

test("median / average / sample size", () => {
  assert.equal(intel.median([]), null);
  assert.equal(intel.median([5, 1, 3]), 3);
  assert.equal(intel.median([4, 1, 3, 2]), 2.5);
  assert.deepEqual(intel.durationStats([], 2), { count: 0, excluded: 2, medianHours: null, averageHours: null });
  assert.deepEqual(intel.durationStats([3_600_000, 3 * 3_600_000, -5]), { count: 2, excluded: 0, medianHours: 2, averageHours: 2 });
});

// ------------------------------------------------------------------ processing times

test("processing times use event timestamps, never updatedAt; missing events are excluded", () => {
  const created = "2026-09-01T00:00:00.000Z";
  const at = (hours: number) => new Date(Date.parse(created) + hours * 3_600_000).toISOString();
  const orders = [
    { id: 1, status: "COMPLETED", createdAt: created },
    { id: 2, status: "PAID", createdAt: created },
    { id: 3, status: "COMPLETED", createdAt: created }, // legacy: no events
    { id: 4, status: "AWAITING_PAYMENT", createdAt: created }, // not paid yet: not excluded
  ];
  const events = [
    { orderId: 1, action: "ORDER_PAID", at: at(2) },
    { orderId: 1, action: "ORDER_FULFILLING", at: at(3) },
    { orderId: 1, action: "ORDER_COMPLETED", at: at(6) },
    { orderId: 2, action: "ORDER_PAID", at: at(4) },
  ];
  const result = intel.processingTimes(orders, events);

  assert.deepEqual(result.createdToPaid, { count: 2, excluded: 1, medianHours: 3, averageHours: 3 });
  assert.deepEqual(result.paidToCompleted, { count: 1, excluded: 1, medianHours: 4, averageHours: 4 });
});

test("support first response from message timestamps; unanswered tickets are excluded", () => {
  const result = intel.firstResponseTimes([
    { messages: [{ sender: "CUSTOMER", createdAt: "2026-09-01T10:00:00Z" }, { sender: "ADMIN", createdAt: "2026-09-01T11:30:00Z" }, { sender: "ADMIN", createdAt: "2026-09-01T12:00:00Z" }] },
    { messages: [{ sender: "CUSTOMER", createdAt: "2026-09-01T10:00:00Z" }] },
    { messages: [] },
  ]);
  assert.deepEqual(result, { count: 1, excluded: 1, medianHours: 1.5, averageHours: 1.5 });
});

// ------------------------------------------------------------------ permissions

test("section gates: money only with finance; each role sees only its sections", () => {
  assert.deepEqual(intel.allowedSections("OWNER"), [...intel.INTEL_SECTIONS]);
  assert.deepEqual(intel.allowedSections("ADMIN"), [...intel.INTEL_SECTIONS]);
  assert.deepEqual(intel.allowedSections("OPERATOR"), ["sales", "orders", "customers", "subscriptions", "support"]);
  assert.deepEqual(intel.allowedSections("SUPPORT"), ["customers", "support"]);
  assert.deepEqual(intel.allowedSections("CONTENT"), ["sales", "promotions"]);
  assert.deepEqual(intel.allowedSections("CUSTOMER"), []);
  assert.deepEqual(intel.allowedSections(""), []);
  for (const role of ["OPERATOR", "SUPPORT", "CONTENT", "CUSTOMER"]) assert.ok(!intel.canSection(role, "finance"), role);
});

test("page gates", () => {
  const pages = intel.INTEL_PAGES;
  assert.ok(pages.revenue("OWNER") && !pages.revenue("OPERATOR") && !pages.revenue("CONTENT"));
  assert.ok(pages.products("CONTENT") && pages.products("OPERATOR") && !pages.products("SUPPORT"));
  assert.ok(pages.customers("SUPPORT") && !pages.customers("CONTENT"));
  assert.ok(pages.promotions("CONTENT") && !pages.promotions("OPERATOR"));
  assert.ok(pages.analyst("OPERATOR") && pages.analyst("OWNER") && !pages.analyst("SUPPORT") && !pages.analyst("CONTENT"));
  assert.ok(!pages.overview("CUSTOMER"));
});

test("stored reports are readable only with every section's permission", () => {
  assert.ok(intel.canReadReport("OWNER", ["finance", "orders"]));
  assert.ok(!intel.canReadReport("OPERATOR", ["finance", "orders"]), "an operator never opens a report with money in it");
  assert.ok(intel.canReadReport("OPERATOR", ["sales", "orders", "customers"]));
  assert.ok(!intel.canReadReport("SUPPORT", ["customers"]), "no analyst access");
  assert.ok(!intel.canReadReport("OWNER", ["unknown-section"]));
});

// ------------------------------------------------------------------ fact verification

const verify = (text: string, facts: object) =>
  analyst.verifyReport({ headline: "", dataGaps: [], sections: [{ key: "summary", title: "", statements: [{ kind: "FACT", text }] }] }, facts).sections[0].statements[0].verified;

const namedFacts = {
  period: { label: "آخر 30 يوم", from: "2026-09-01", to: "2026-09-30", comparison: "مقارنة بالثلاثين يومًا التي قبلها" },
  products: [
    { name: "VIP 3 أشهر", units: 4, revenue: 60000, sharePct: 42.9 },
    { name: "VIP 3 أشهر + جهاز 4K", units: 2, revenue: 80000, sharePct: 57.1 },
  ],
  revenue: { current: 140000, previous: 100000, pct: 40 },
};

test("digits inside product names are not numeric claims", () => {
  assert.equal(verify("«VIP 3 أشهر» حقق 42.9% من الإيرادات.", namedFacts), true);
  assert.equal(verify("«VIP 3 أشهر + جهاز 4K» بيع 2 مرة.", namedFacts), true, "the longest name is masked first");
  assert.equal(verify("Most sold: VIP 3 أشهر with 4 purchases", namedFacts), true);
});

test("numbers outside names are still verified", () => {
  assert.equal(verify("«VIP 3 أشهر» بيع 7 مرات.", namedFacts), false, "an invented count next to a real name fails");
  assert.equal(verify("«VIP 5 أشهر» حقق 42.9%.", namedFacts), false, "a name not in the pack is not masked");
  assert.equal(verify("3 عمليات بيع.", namedFacts), false, "a bare 3 is not whitelisted by the name");
});

test("real numbers, percentages, currency, Arabic-Indic digits and dates", () => {
  assert.equal(verify("الإيرادات 140,000 د.ع بزيادة 40.0%.", namedFacts), true);
  assert.equal(verify("الإيرادات ١٤٠٬٠٠٠ د.ع بزيادة ٤٠٫٠٪.", namedFacts), true);
  assert.equal(verify("Revenue 150,000 IQD.", namedFacts), false);
  assert.equal(verify("زيادة 41.0%.", namedFacts), false);
  assert.equal(verify("من 2026-09-01 إلى 2026-09-30.", namedFacts), true);
  assert.equal(verify("من ٢٠٢٦-٠٩-٠١.", namedFacts), true);
  assert.equal(verify("منذ 2026-08-15.", namedFacts), false, "a date not in the pack fails as a whole token");
  assert.equal(verify("الفترة: آخر 30 يوم.", namedFacts), true, "the period label is a pack name");
});

test("a numeric-only 'name' can't whitelist numbers", () => {
  const facts = { products: [{ name: "2026", units: 1 }] };
  assert.equal(verify("2026 sales", facts), false);
  assert.deepEqual(analyst.factContext(facts).names, []);
});

// ------------------------------------------------------------------ rule-based report

const zero = intel.compare(0, 0);
const DURATION_NONE = intel.durationStats([]);

function fullPack(over: Partial<Pack> = {}): Pack {
  return {
    kind: "intelligence",
    period: { key: "last30", label: "آخر 30 يوم", from: "2026-09-01", to: "2026-09-30", comparison: "مقارنة بالثلاثين يومًا التي قبلها", timeZone: "Asia/Baghdad" },
    currency: "IQD",
    sections: [...intel.INTEL_SECTIONS],
    finance: {
      revenue: intel.compare(140000, 100000),
      completedSales: intel.compare(4, 3),
      averageOrderValue: { current: 35000, previous: 33333 },
      expensesRecorded: false,
      expenses: null,
      netProfit: { status: "incomplete", current: null, previous: null },
      topProducts: [{ name: "VIP 3 أشهر", revenue: 140000, sharePct: 100 }],
    },
    sales: { completedSales: intel.compare(4, 3), products: [{ name: "VIP 3 أشهر", kind: "package", units: 4, previousUnits: 3 }], mostSold: { name: "VIP 3 أشهر", units: 4 } },
    orders: {
      created: intel.compare(6, 5),
      cancelled: intel.compare(1, 0),
      paidOfCreatedPct: 66.7,
      awaitingPaymentNow: 2,
      proofsAwaitingReviewNow: 1,
      readyToActivateNow: 1,
      createdToPaid: intel.durationStats([3_600_000, 7_200_000], 1),
      paidToCompleted: intel.durationStats([1_800_000]),
    },
    customers: { new: intel.compare(3, 0), paying: intel.compare(4, 3), returning: 1, firstTime: 3, total: 20 },
    subscriptions: { expiringWindowDays: 7, active: 9, expiring: 2, expired: 4, suspended: 0, dueForRenewal: 5, renewals: intel.compare(1, 0), byPackage: [{ name: "VIP 3 أشهر", active: 9 }] },
    support: { created: intel.compare(2, 2), open: 3, waitingOnTeam: 1, firstResponse: intel.durationStats([5_400_000], 1) },
    promotions: { endingSoonDays: 7, live: 2, scheduled: 1, ended: 3, inactive: 1, endingSoon: 1, notificationsSent: intel.compare(10, 4), notificationsRead: 6 },
    unavailable: intel.structuralGaps([...intel.INTEL_SECTIONS], "ar"),
    ...over,
  };
}

test("the rule-based report: fixed sections, every FACT verifies, kinds stay in place", () => {
  for (const lang of ["ar", "en"] as const) {
    const pack = fullPack();
    const report = analyst.verifyReport(intel.ruleBasedIntelligenceReport(pack, lang), pack);
    const keys = report.sections.map((section) => section.key);
    assert.deepEqual(keys, ["summary", "numbers", "changes", "attention", "recommendations", "gaps"]);
    const unverified = report.sections.flatMap((section) => section.statements).filter((item) => item.kind === "FACT" && item.verified === false);
    assert.deepEqual(unverified, [], `${lang}: ${JSON.stringify(unverified)}`);
    assert.ok(report.sections.find((section) => section.key === "recommendations")!.statements.every((item) => item.kind === "RECOMMENDATION"));
    assert.ok(report.sections.find((section) => section.key === "numbers")!.statements.every((item) => item.kind === "FACT"));
    const all = report.sections.flatMap((section) => section.statements).map((item) => item.text).join("\n");
    assert.doesNotMatch(all, /NaN|Infinity|undefined|null/);
    if (lang === "ar") assert.match(all, /صافي الربح غير قابل للحساب/);
    if (lang === "ar") assert.match(all, /لا تتوفر مقارنة نسبية/, "previous = 0 says so");
  }
});

test("a pack without finance never mentions money", () => {
  const pack = fullPack({ finance: undefined, sections: ["sales", "orders", "customers", "subscriptions", "support"] });
  const report = analyst.verifyReport(intel.ruleBasedIntelligenceReport(pack, "ar"), pack);
  const all = report.sections.flatMap((section) => section.statements).map((item) => item.text).join("\n") + report.headline;
  assert.doesNotMatch(all, /د\.ع|IQD|الإيرادات|ربح/);
});

test("an empty period is zero, not an error, and not a fake change", () => {
  const pack = fullPack({
    finance: { revenue: zero, completedSales: zero, averageOrderValue: { current: null, previous: null }, expensesRecorded: false, expenses: null, netProfit: { status: "incomplete", current: null, previous: null }, topProducts: [] },
    sales: { completedSales: zero, products: [], mostSold: null },
    orders: { created: zero, cancelled: zero, paidOfCreatedPct: null, awaitingPaymentNow: 0, proofsAwaitingReviewNow: 0, readyToActivateNow: 0, createdToPaid: DURATION_NONE, paidToCompleted: DURATION_NONE },
  });
  const report = analyst.verifyReport(intel.ruleBasedIntelligenceReport(pack, "ar"), pack);
  const all = report.sections.flatMap((section) => section.statements);
  assert.ok(all.filter((item) => item.kind === "FACT").every((item) => item.verified !== false));
  assert.ok(all.some((item) => /لا يوجد نشاط بالفترتين/.test(item.text)));
  assert.ok(all.some((item) => /لا توجد عينة كافية/.test(item.text)));
  assert.doesNotMatch(report.headline, /[↑↓]/);
});

test("misplaced statements move to their kind's section, keeping their kind", () => {
  const report = intel.normalizeIntelReport(
    {
      headline: "h",
      dataGaps: [],
      sections: [{ key: "numbers", title: "x", statements: [{ kind: "RECOMMENDATION", text: "do x" }, { kind: "INTERPRETATION", text: "maybe" }, { kind: "FACT", text: "fact" }] }],
    },
    "ar",
  );
  assert.deepEqual(report.sections.map((section) => [section.key, section.title, section.statements.map((item) => item.kind)]), [
    ["numbers", "الأرقام المهمة", ["FACT"]],
    ["attention", "نقاط تحتاج انتباه", ["INTERPRETATION"]],
    ["recommendations", "توصيات", ["RECOMMENDATION"]],
  ]);
});

test("the AI payload carries aggregates and product names only", () => {
  const text = JSON.stringify(fullPack());
  assert.doesNotMatch(text, /phone|password|username|userName|receipt|proof"|token|secret/i);
});
