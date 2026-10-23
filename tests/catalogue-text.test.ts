import assert from "node:assert/strict";
import { test } from "node:test";

const { distinctHighlights, repeatsDuration } = await import("@/app/ui/catalogue-text");

const threeMonths = { durationMonths: 3, durationLabel: "3 أشهر" };
const sixMonths = { durationMonths: 6, durationLabel: "6 أشهر" };
const oneYear = { durationMonths: 12, durationLabel: "سنة واحدة" };
const twoYears = { durationMonths: 24, durationLabel: "سنتان" };

test("text that is exactly the package's own duration is a repeat", () => {
  // Names, descriptions and specification lines as the catalogue has them.
  assert.ok(repeatsDuration("IPTV 3 أشهر", threeMonths));
  assert.ok(repeatsDuration("اشتراك IPTV لمدة 3 أشهر", threeMonths));
  assert.ok(repeatsDuration("اشتراك لمدة 6 أشهر", sixMonths));
  assert.ok(repeatsDuration("IPTV 12 شهرًا", oneYear));
  assert.ok(repeatsDuration("اشتراك IPTV لمدة سنة واحدة", oneYear));
  assert.ok(repeatsDuration("اشتراك لمدة 12 شهرًا", oneYear));
  assert.ok(repeatsDuration("IPTV 24 شهرًا", twoYears));
  assert.ok(repeatsDuration("اشتراك IPTV لمدة سنتين", twoYears));
  // Other spellings of the same duration.
  assert.ok(repeatsDuration("12 شهراً", oneYear), "alef before tanween");
  assert.ok(repeatsDuration("1 year", oneYear));
  assert.ok(repeatsDuration("3 months", threeMonths));
  assert.ok(repeatsDuration("سنه واحده", oneYear));
});

test("a different duration is not hidden: it may be an offer or a real feature", () => {
  assert.ok(!repeatsDuration("3 أشهر", oneYear));
  assert.ok(!repeatsDuration("سنتان", oneYear));
  assert.ok(!repeatsDuration("6 months", oneYear));
  assert.ok(!repeatsDuration("IPTV 6 أشهر", threeMonths));
  assert.ok(!repeatsDuration("سنة واحدة", twoYears));
});

test("a real feature that mentions a duration is kept", () => {
  assert.ok(!repeatsDuration("3 أشهر مجانًا", oneYear));
  assert.ok(!repeatsDuration("+3 أشهر مجانًا", threeMonths));
  assert.ok(!repeatsDuration("ضمان 12 شهر", oneYear));
  assert.ok(!repeatsDuration("3 أشهر مجانًا", threeMonths), "extra words keep even the same number");
  assert.ok(!repeatsDuration("تجديد كل 3 أشهر بدون جهاز", threeMonths));
});

test("ordinary features stay: 4K, screens, support", () => {
  for (const feature of ["4K", "حتى 3 شاشات", "حتى 3 شاشات للعائلة", "بدون تقطيع", "دعم فني", "قنوات رياضية وأفلام بجودة 4K", "قنوات معتمدة"]) {
    assert.ok(!repeatsDuration(feature, threeMonths), feature);
    assert.ok(!repeatsDuration(feature, oneYear), feature);
  }
});

test("general words alone are never hidden", () => {
  for (const text of ["VIP", "IPTV", "اشتراك VIP", "باقة", "VIP بريميوم", "VIP عائلي", "", "   "]) {
    assert.ok(!repeatsDuration(text, threeMonths), JSON.stringify(text));
  }
  assert.ok(!repeatsDuration(null, threeMonths));
  assert.ok(!repeatsDuration(undefined, threeMonths));
});

test("distinctHighlights drops only own-duration lines and keeps order and limit", () => {
  const pkg = { ...oneYear, features: ["اشتراك لمدة 12 شهرًا", "4K", "3 أشهر مجانًا", "VIP", "حتى 3 شاشات", "دعم فني"] };

  assert.deepEqual(distinctHighlights(pkg, 10), ["4K", "3 أشهر مجانًا", "VIP", "حتى 3 شاشات", "دعم فني"]);
  assert.deepEqual(distinctHighlights(pkg, 2), ["4K", "3 أشهر مجانًا"]);
  assert.deepEqual(distinctHighlights({ ...threeMonths, features: ["", "4K"] }, 5), ["4K"]);
});
