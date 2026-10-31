import assert from "node:assert/strict";
import { test } from "node:test";

const { planMigration, readChain } = await import("../scripts/db/production-migrate.mjs");

type Migration = { name: string; from: string | null; to: string; hash: string };

const chain: Migration[] = readChain();
const byName: Record<string, Migration> = Object.fromEntries(chain.map((m) => [m.name, m]));
const before = chain.filter((m) => m.name < "20261016");
const ledgerOf = (items: { name: string; hash: string }[]) => items.map((m) => ({ migration_name: m.name, migration_hash: m.hash }));

test("production state (marker bec797, ledger up to console_device) → exactly the package, loyalty, cost and discount migrations, in order", () => {
  const plan = planMigration({ chain, ledger: ledgerOf(before), marker: byName["20261001T2236_console_device"].to });

  assert.equal(plan.ok, true, plan.problems.join("; "));
  assert.deepEqual(plan.pending, ["20261016T0559_package_duration_unit", "20261017T1832_package_renewal_price", "20261030T1021_package_options", "20261030T1747_loyalty_points", "20261030T2329_real_costs", "20261031T0021_discounts"]);
  assert.equal(plan.tip, byName["20261031T0021_discounts"].to);
});

test("package migrations already applied → only the package options migration is pending", () => {
  const applied = chain.filter((m) => m.name <= "20261017T1832_package_renewal_price");
  const plan = planMigration({ chain, ledger: ledgerOf(applied), marker: byName["20261017T1832_package_renewal_price"].to });

  assert.equal(plan.ok, true, plan.problems.join("; "));
  assert.deepEqual(plan.pending, ["20261030T1021_package_options", "20261030T1747_loyalty_points", "20261030T2329_real_costs", "20261031T0021_discounts"]);
});

test("package options applied (production after PR #6) → the loyalty, cost and discount migrations are pending", () => {
  const applied = chain.filter((m) => m.name <= "20261030T1021_package_options");
  const plan = planMigration({ chain, ledger: ledgerOf(applied), marker: byName["20261030T1021_package_options"].to });

  assert.equal(plan.ok, true, plan.problems.join("; "));
  assert.deepEqual(plan.pending, ["20261030T1747_loyalty_points", "20261030T2329_real_costs", "20261031T0021_discounts"]);
});

test("loyalty applied (marker 0395c5) → the real costs and discount migrations are pending", () => {
  const applied = chain.filter((m) => m.name <= "20261030T1747_loyalty_points");
  const plan = planMigration({ chain, ledger: ledgerOf(applied), marker: byName["20261030T1747_loyalty_points"].to });

  assert.equal(plan.ok, true, plan.problems.join("; "));
  assert.deepEqual(plan.pending, ["20261030T2329_real_costs", "20261031T0021_discounts"]);
});

test("real costs applied (production now, marker 76e80b) → only the discounts migration is pending", () => {
  const applied = chain.filter((m) => m.name <= "20261030T2329_real_costs");
  const plan = planMigration({ chain, ledger: ledgerOf(applied), marker: byName["20261030T2329_real_costs"].to });

  assert.equal(plan.ok, true, plan.problems.join("; "));
  assert.deepEqual(plan.pending, ["20261031T0021_discounts"]);
});

test("up to date → nothing pending", () => {
  const plan = planMigration({ chain, ledger: ledgerOf(chain), marker: byName["20261031T0021_discounts"].to });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.pending, []);
});

test("an applied migration whose hash differs from the repository is refused", () => {
  const ledger = ledgerOf([...before, { ...byName["20261016T0559_package_duration_unit"], hash: "1746f26ec3b2fbae7380a8d918f6effa37619f7540b3a4153ebf7c822192a649" }]);
  const plan = planMigration({ chain, ledger, marker: byName["20261016T0559_package_duration_unit"].to });

  assert.equal(plan.ok, false);
  assert.match(plan.problems.join(), /20261016T0559_package_duration_unit changed: database 1746f26ec3b2 ≠ repository/);
});

test("unknown marker or a ledger entry missing from the repository is refused", () => {
  assert.equal(planMigration({ chain, ledger: ledgerOf(before), marker: "f".repeat(64) }).ok, false);
  assert.equal(planMigration({ chain, ledger: [...ledgerOf(before), { migration_name: "20990101T0000_unknown", migration_hash: "x" }], marker: byName["20261001T2236_console_device"].to }).ok, false);
});
