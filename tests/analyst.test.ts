import assert from "node:assert/strict";
import { test } from "node:test";

const analyst = await import("@/src/lib/analyst");

type FactPack = import("@/src/lib/analyst").FactPack;

const facts = (extra: Partial<FactPack> = {}): FactPack => ({
  period: { key: "month", label: "this month", from: "2026-09-01", to: "2026-09-30", comparison: "vs the same point last month", timeZone: "Asia/Baghdad" },
  currency: "IQD",
  revenue: { current: 140000, previous: 100000, changePct: 40, completedSales: 4, previousCompletedSales: 3 },
  expenses: { recorded: false, current: null, previous: null, changePct: null },
  netProfit: { status: "incomplete", current: null, previous: null },
  averageOrderValue: { current: 35000, previous: 33333 },
  products: [{ name: "IPTV سنة", kind: "package", units: 4, revenue: 140000, sharePct: 100, previousUnits: 3 }],
  mostSold: { name: "IPTV سنة", units: 4, revenue: 140000, sharePct: 100 },
  orders: { created: 6, paidOrCompleted: 4, awaitingPayment: 1, inFulfilment: 0, cancelled: 1, rejected: 0, conversionPct: 66.7, previous: { created: 5, paidOrCompleted: 3, cancelled: 0, conversionPct: 60 } },
  customers: { new: 3, paying: 4, returning: 1, renewals: 1, previousRenewals: 0, activeSubscribersNow: 9, expiringNow: 2, revenuePerCustomer: 35000 },
  paymentProofs: { awaitingReview: 1, uploadedThisPeriod: 2, uploadedPreviousPeriod: 1 },
  unavailable: ["Website visits and traffic sources are not collected."],
  ...extra,
});

test("numbers are extracted from Western and Arabic-Indic text", () => {
  assert.deepEqual(analyst.extractNumbers("Revenue 140,000 IQD, up 40.0%"), [140000, 40]);
  assert.deepEqual(analyst.extractNumbers("الإيرادات ١٤٠٬٠٠٠ د.ع بزيادة ٤٠٫٥٪"), [140000, 40.5]);
});

test("a FACT is verified only when every number exists in the fact pack", () => {
  const numbers = analyst.factNumbers(facts());
  assert.equal(analyst.verifyStatement({ kind: "FACT", text: "Revenue was 140,000 IQD from 4 sales." }, numbers).verified, true);
  assert.equal(analyst.verifyStatement({ kind: "FACT", text: "Revenue was 150,000 IQD." }, numbers).verified, false);
  // Non-facts are not number-checked (they must not carry numbers as facts anyway).
  assert.equal(analyst.verifyStatement({ kind: "INTERPRETATION", text: "Maybe 999 visitors." }, numbers).verified, undefined);
});

test("verifyReport allows the period's own dates and flags invented figures", () => {
  const report = analyst.verifyReport(
    {
      headline: "x",
      dataGaps: [],
      sections: [
        {
          key: "summary",
          title: "Summary",
          statements: [
            { kind: "FACT", text: "From 2026-09-01 to 2026-09-30 revenue was 140,000 IQD." },
            { kind: "FACT", text: "The site had 12,500 visitors." },
          ],
        },
      ],
    },
    facts(),
  );
  assert.deepEqual(report.sections[0].statements.map((item) => item.verified), [true, false]);
});

test("the rule-based analyst never states a profit without expenses, and every FACT verifies", () => {
  for (const lang of ["en", "ar"] as const) {
    const pack = facts();
    const report = analyst.verifyReport(analyst.ruleBasedReport(pack, lang), pack);
    const all = report.sections.flatMap((section) => section.statements);
    const unverified = all.filter((item) => item.kind === "FACT" && item.verified === false);

    assert.deepEqual(unverified, [], `${lang}: ${JSON.stringify(unverified)}`);
    assert.ok(report.sections.some((section) => section.key === "webapp"));
    assert.ok(all.some((item) => /net profit cannot be calculated|لا يمكن حساب صافي الربح/.test(item.text)));
    assert.ok(!all.some((item) => /net profit (was|of) \d/i.test(item.text)));
  }
});

test("with expenses recorded the rule-based analyst reports net profit from the facts", () => {
  const pack = facts({ expenses: { recorded: true, current: 50000, previous: 0, changePct: null }, netProfit: { status: "ok", current: 90000, previous: 100000 } });
  const report = analyst.verifyReport(analyst.ruleBasedReport(pack, "en"), pack);
  const financial = report.sections.find((section) => section.key === "financial")!;

  assert.ok(financial.statements.some((item) => item.text.includes("90,000") && item.verified === true));
});

test("no previous revenue means no invented change", () => {
  const pack = facts({ revenue: { current: 35000, previous: 0, changePct: null, completedSales: 1, previousCompletedSales: 0 } });
  const report = analyst.ruleBasedReport(pack, "en");

  assert.match(report.sections[0].statements[1].text, /no previous-period revenue/);
  assert.doesNotMatch(report.headline, /[↑↓]/);
});
