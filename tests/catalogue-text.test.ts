import assert from "node:assert/strict";
import { test } from "node:test";

const { distinctHighlights, distinctLines, repeatsDuration, repeatsTitle } = await import("@/app/ui/catalogue-text");

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

test("repeatsTitle: a line whose words are all in the title adds nothing", () => {
  assert.ok(repeatsTitle("اشتراك IPTV لمدة 3 أشهر", "IPTV 3 أشهر"));
  assert.ok(repeatsTitle("3 أشهر", "IPTV 3 أشهر"));
  assert.ok(repeatsTitle("اشتراك لمدة 12 شهرًا", "IPTV 12 شهرًا"));
  assert.ok(!repeatsTitle("قنوات رياضية وأفلام بجودة 4K", "VIP بريميوم"), "own words stay");
  assert.ok(!repeatsTitle("3 أشهر", "VIP بريميوم"), "a duration not in the title stays");
  assert.ok(!repeatsTitle("VIP", "VIP بريميوم"), "general words alone stay");
  assert.ok(!repeatsTitle("3 أشهر مجانًا", "IPTV 3 أشهر"), "an extra word keeps the line");
});

test("distinctLines drops title repeats, own-duration repeats and duplicates, in order", () => {
  const year = { durationMonths: 12, durationLabel: "سنة واحدة" };

  // An IPTV scene as the catalogue builds it: subtitle, facts, chips.
  assert.deepEqual(distinctLines(["اشتراك IPTV لمدة سنة واحدة", "سنة واحدة", "اشتراك لمدة 12 شهرًا"], "IPTV 12 شهرًا", year), []);
  // A VIP scene ("VIP بريميوم" does not show the duration, so no duration is passed):
  // the duration line, the description and the real features stay; only the duplicate "4K" goes.
  assert.deepEqual(
    distinctLines(["قنوات رياضية وأفلام بجودة 4K", "3 أشهر", "4K", "بدون تقطيع", "4K", "دعم فني"], "VIP بريميوم"),
    ["قنوات رياضية وأفلام بجودة 4K", "3 أشهر", "4K", "بدون تقطيع", "دعم فني"],
  );
  // The showcase only passes a duration when the title already shows it.
  assert.ok(repeatsDuration("IPTV 12 شهرًا", year));
  assert.ok(!repeatsDuration("VIP بريميوم", { durationMonths: 3, durationLabel: "3 أشهر" }));
  // Without a known duration, only title repeats and duplicates go.
  assert.deepEqual(distinctLines(["HDMI", "Wi-Fi", "HDMI", null, ""], "جهاز VIP Stick"), ["HDMI", "Wi-Fi"]);
});
