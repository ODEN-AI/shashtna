import assert from "node:assert/strict";
import { test } from "node:test";

const options = await import("@/src/lib/package-options");
const { planOrderPrice } = await import("@/src/lib/catalogue");

const row = (id: number, durationMonths: number, price: number, extra: Partial<{ renewalPrice: number | null; isActive: boolean }> = {}) => ({
  id,
  durationMonths,
  durationUnit: "MONTH",
  durationLabel: `${durationMonths}`,
  price,
  renewalPrice: extra.renewalPrice ?? null,
  isActive: extra.isActive ?? true,
});

test("one IPTV package takes several lengths, each with its own price", () => {
  const result = options.parsePackageOptions(
    [
      { durationValue: 3, durationUnit: "MONTH", price: 6000 },
      { durationValue: 6, durationUnit: "MONTH", price: 10000, renewalPrice: 9000 },
      { durationValue: 1, durationUnit: "YEAR", price: 15000 },
      { durationValue: 2, durationUnit: "YEAR", price: 25000, durationLabel: "سنتان كاملتان" },
    ],
    "IPTV",
  );

  assert.ok(result.ok);
  assert.deepEqual(
    result.options.map((option) => [option.durationMonths, option.price, option.renewalPrice]),
    [[3, 6000, null], [6, 10000, 9000], [12, 15000, null], [24, 25000, null]],
  );
  assert.equal(result.options[2].durationUnit, "YEAR");
  assert.equal(result.options[2].durationLabel, "سنة واحدة", "the label defaults to the Arabic length");
  assert.equal(result.options[3].durationLabel, "سنتان كاملتان", "a custom label is kept");
});

test("any length the system supports: 1 to 60 months, not only 3/6/12/24", () => {
  for (const [value, unit, months] of [[1, "MONTH", 1], [7, "MONTH", 7], [18, "MONTH", 18], [5, "YEAR", 60]] as const) {
    const result = options.parsePackageOptions([{ durationValue: value, durationUnit: unit, price: 1000 }], "IPTV");
    assert.ok(result.ok, `${value} ${unit}`);
    assert.equal(result.options[0].durationMonths, months);
  }

  for (const bad of [0, -1, 1.5, "6", 61]) {
    assert.equal(options.parsePackageOptions([{ durationValue: bad, durationUnit: "MONTH", price: 1000 }], "IPTV").ok, false, String(bad));
  }

  assert.equal(options.parsePackageOptions([{ durationValue: 6, durationUnit: "YEAR", price: 1000 }], "IPTV").ok, false, "6 years is over the 5-year limit");
  assert.equal(options.parsePackageOptions([{ durationValue: 3, durationUnit: "DAY", price: 1000 }], "IPTV").ok, false, "days are not a unit");
});

test("prices are validated per option, never coerced", () => {
  for (const price of [-1, 1.5, "6000", null, undefined, 1e12]) {
    assert.equal(options.parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price }], "IPTV").ok, false, String(price));
  }

  assert.equal(options.parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 6000, renewalPrice: "5000" }], "IPTV").ok, false);
  assert.ok(options.parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 0, renewalPrice: "" }], "IPTV").ok, "free and an empty renewal price are allowed");
});

test("the same length can't appear twice, and at least one length must be on sale", () => {
  const same = options.parsePackageOptions(
    [
      { durationValue: 12, durationUnit: "MONTH", price: 15000 },
      { durationValue: 1, durationUnit: "YEAR", price: 14000 },
    ],
    "IPTV",
  );
  assert.equal(same.ok, false, "12 months and 1 year are the same length");

  assert.equal(options.parsePackageOptions([], "IPTV").ok, false);
  assert.equal(options.parsePackageOptions("3 months", "IPTV").ok, false);
  assert.equal(options.parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 6000, isActive: false }], "IPTV").ok, false);
  assert.equal(options.parsePackageOptions([{ durationValue: 3, durationUnit: "MONTH", price: 6000, isActive: "yes" }], "IPTV").ok, false);
  assert.equal(
    options.parsePackageOptions(Array.from({ length: options.MAX_PACKAGE_OPTIONS + 1 }, (_, index) => ({ durationValue: index + 1, durationUnit: "MONTH", price: 1000 })), "IPTV").ok,
    false,
  );
});

test("existing options keep their id; malformed or repeated ids are refused", () => {
  const kept = options.parsePackageOptions([{ id: 7, durationValue: 3, durationUnit: "MONTH", price: 6000 }, { durationValue: 6, durationUnit: "MONTH", price: 10000 }], "IPTV");
  assert.ok(kept.ok);
  assert.deepEqual(kept.options.map((option) => option.id), [7, null]);

  assert.equal(options.parsePackageOptions([{ id: "7", durationValue: 3, durationUnit: "MONTH", price: 6000 }], "IPTV").ok, false);
  assert.equal(options.parsePackageOptions([{ id: 7, durationValue: 3, durationUnit: "MONTH", price: 6000 }, { id: 7, durationValue: 6, durationUnit: "MONTH", price: 1 }], "IPTV").ok, false);
});

test("VIP packages keep one three-month option, whatever length is sent", () => {
  const vip = options.parsePackageOptions([{ durationValue: 12, durationUnit: "MONTH", price: 45000, renewalPrice: 35000 }], "VIP");
  assert.ok(vip.ok);
  assert.equal(vip.options[0].durationMonths, options.VIP_DURATION_MONTHS);
  assert.equal(vip.options[0].renewalPrice, 35000);

  assert.equal(
    options.parsePackageOptions([{ price: 45000 }, { price: 50000 }], "VIP").ok,
    false,
    "VIP never gets a second length",
  );
});

test("the default option is the shortest active one, and the package mirrors it", () => {
  const list = [row(1, 12, 15000), row(2, 3, 6000, { isActive: false }), row(3, 6, 10000), row(4, 24, 25000)];
  const fallback = options.defaultOption(list);

  assert.equal(fallback?.id, 3, "an inactive option is never the default");
  assert.deepEqual(options.packageMirror(fallback!), { price: 10000, renewalPrice: null, durationMonths: 6, durationUnit: "MONTH", durationLabel: "6" });
  assert.equal(options.defaultOption([row(1, 3, 6000, { isActive: false })]), null);
  assert.deepEqual(options.sortOptions(list).map((option) => option.id), [2, 3, 1, 4]);
});

test("an order is priced from the option the customer chose, checked on the server", () => {
  const list = [row(10, 3, 6000), row(11, 6, 10000, { renewalPrice: 9000 }), row(12, 12, 15000, { isActive: false })];

  const chosen = options.resolveOrderOption(list, "11");
  assert.ok(chosen.ok);
  assert.equal(chosen.option.id, 11);
  assert.equal(planOrderPrice(chosen.option, "NEW"), 10000);
  assert.equal(planOrderPrice(chosen.option, "RENEW"), 9000, "renewals use that length's renewal price");

  const fallback = options.resolveOrderOption(list, undefined);
  assert.ok(fallback.ok);
  assert.equal(fallback.option.id, 10, "older clients without a choice get the default option");

  for (const bad of ["12", 12, "99", "abc", -1, 1.5]) {
    assert.equal(options.resolveOrderOption(list, bad).ok, false, `option ${bad} is refused, not swapped for another`);
  }

  assert.equal(options.resolveOrderOption([row(1, 3, 6000, { isActive: false })], undefined).ok, false, "a package with nothing on sale can't be ordered");
});

test("option ids from URLs and forms", () => {
  assert.equal(options.optionIdParam("5"), 5);
  assert.equal(options.optionIdParam(["8", "9"]), 8);
  for (const bad of [undefined, "", "0", "-2", "1.5", "x"]) assert.equal(options.optionIdParam(bad), null, String(bad));
});
