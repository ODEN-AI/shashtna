import { formatDuration } from "@/src/lib/subscription-duration";

/**
 * Display helpers for catalogue text on /plans and /checkout. Admins often
 * write a package's name, description or a specification line as just its
 * own duration ("IPTV 3 أشهر", "اشتراك لمدة 12 شهرًا"). Where the duration is
 * already shown, such a line only repeats it, so those two pages hide it.
 *
 * Deliberately narrow: a line is hidden only when, after dropping a few
 * filler words, it is exactly THIS package's duration. A different duration
 * ("3 أشهر" on a yearly plan), anything with extra words ("3 أشهر مجانًا"),
 * and lines that are only general words ("VIP", "اشتراك VIP") stay visible.
 * When in doubt, the text is shown. Nothing here changes stored data.
 */

type DurationSource = { durationMonths: number; durationLabel: string };

// Whole words that carry no information next to a duration.
const FILLER = new Set(["iptv", "vip", "subscription", "plan", "for", "اشتراك", "باقه", "لمده", "مده"]);

/** Lower-case, no diacritics, one spelling for alef/hamza and taa marbuta, no punctuation. */
function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.,،:;·\-–—()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every way this package's own duration is commonly written. */
function ownDurationForms(pkg: DurationSource) {
  const months = pkg.durationMonths;
  const forms = [
    pkg.durationLabel,
    formatDuration(months, "ar"),
    formatDuration(months, "en"),
    `${months} شهر`,
    `${months} شهرا`,
    `${months} شهور`,
    `${months} اشهر`,
    `${months} month`,
    `${months} months`,
  ];

  if (months === 1) {
    forms.push("شهر", "شهر واحد", "a month", "one month");
  }

  if (months > 0 && months % 12 === 0) {
    const years = months / 12;
    forms.push(`${years} سنه`, `${years} سنوات`, `${years} سنين`, `${years} year`, `${years} years`);
    if (years === 1) forms.push("سنه", "سنه واحده", "عام", "عام واحد", "a year", "one year");
    if (years === 2) forms.push("سنتان", "سنتين", "عامان", "عامين", "two years");
  }

  return new Set(forms.map(normalise));
}

/** True only when the text is exactly this package's duration (plus filler words). */
export function repeatsDuration(text: string | null | undefined, pkg: DurationSource) {
  const words = normalise(String(text ?? "")).split(" ").filter(Boolean);
  const meaningful = words.filter((word) => !FILLER.has(word)).join(" ");

  // Only general words (or nothing): not a duration, so not a repeat.
  if (!meaningful) {
    return false;
  }

  return ownDurationForms(pkg).has(meaningful);
}

/** Specification lines minus the ones that only repeat the package's own duration. */
export function distinctHighlights(pkg: DurationSource & { features: string[] }, max: number) {
  return pkg.features.filter((feature) => feature && !repeatsDuration(feature, pkg)).slice(0, max);
}

function meaningfulWords(text: string | null | undefined) {
  return normalise(String(text ?? "")).split(" ").filter((word) => word && !FILLER.has(word));
}

/**
 * True when every meaningful word of the text is already in the title, so the
 * line says nothing new ("اشتراك IPTV لمدة 3 أشهر" under "IPTV 3 أشهر").
 * Lines made only of general words, or with any word of their own, stay.
 */
export function repeatsTitle(text: string | null | undefined, title: string) {
  const words = meaningfulWords(text);

  if (!words.length) {
    return false;
  }

  const inTitle = new Set(meaningfulWords(title));

  return words.every((word) => inTitle.has(word));
}

/**
 * Keeps the lines that add something: drops a line that repeats the title,
 * repeats the package's own duration (when known), or repeats a line already
 * kept. Order is preserved.
 */
export function distinctLines(lines: (string | null | undefined)[], title: string, duration?: DurationSource) {
  const kept: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const text = String(line ?? "").trim();
    const key = normalise(text);

    if (!text || seen.has(key) || repeatsTitle(text, title) || (duration && repeatsDuration(text, duration))) {
      continue;
    }

    seen.add(key);
    kept.push(text);
  }

  return kept;
}
