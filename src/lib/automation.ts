import { businessDay } from "@/src/lib/business-time";

/**
 * Automation — pure parts (unit-tested).
 *
 * Phase 4, step 1 (council verdict): the owner gets a daily list; customers
 * are contacted only through prefilled WhatsApp links the owner taps to send
 * (wa.me). Nothing is sent from the owner's number automatically, and
 * activation, payment confirmation and reward approval are never automated.
 * Days are Baghdad calendar days.
 */

export const JOBS = ["daily-digest"] as const;
export type Job = (typeof JOBS)[number];

export const RUN_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED", "SKIPPED"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** One run per job per Baghdad day: a second trigger with the same key is a no-op. */
export function runKey(job: Job, now = new Date()) {
  return `${job}:${businessDay(now)}`;
}

// ------------------------------------------------------------------- days

const DAY_MS = 86_400_000;

function utcDay(day: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : Number.NaN;
}

/** Whole Baghdad days from today to a YYYY-MM-DD date (negative = in the past). */
export function daysUntil(day: string, now = new Date()) {
  const diff = utcDay(String(day).slice(0, 10)) - utcDay(businessDay(now));
  return Number.isFinite(diff) ? Math.round(diff / DAY_MS) : null;
}

export const REMINDERS = ["before-expiry", "expiry-day", "win-back"] as const;
export type Reminder = (typeof REMINDERS)[number];

/** Which message a subscription is due for today: 5 days before, on the day, or 3 days after expiry. */
export function reminderFor(expiryDay: string, now = new Date()): Reminder | null {
  const days = daysUntil(expiryDay, now);

  if (days === 5) return "before-expiry";
  if (days === 0) return "expiry-day";
  if (days === -3) return "win-back";

  return null;
}

/** wa:{template}:{subscriptionId}:{endDate} — one message per subscription, reminder and end date. */
export function whatsappDedupeKey(template: Reminder, subscriptionId: number, endDate: string) {
  return `wa:${template}:${subscriptionId}:${String(endDate).slice(0, 10)}`;
}

// ------------------------------------------------------------------- quiet hours

/** "22:00-09:00" → minutes; a malformed value falls back to the default. */
export function parseQuietHours(value: string | null | undefined) {
  const match = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.exec(String(value ?? "").trim());
  const ok = match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[3]) < 24 && Number(match[4]) < 60;

  return ok ? { start: Number(match![1]) * 60 + Number(match![2]), end: Number(match![3]) * 60 + Number(match![4]) } : { start: 22 * 60, end: 9 * 60 };
}

export function isQuietHours(value: string | null | undefined, now = new Date()) {
  const { start, end } = parseQuietHours(value);
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 3 * 60) % (24 * 60); // Baghdad, UTC+3

  return start === end ? false : start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

// ------------------------------------------------------------------- where it may run

/**
 * Previews share the production database, so jobs run only on the
 * production deploy (Netlify CONTEXT) or against a local database.
 */
export function canRunHere(env: { CONTEXT?: string }, databaseHost: string) {
  return env.CONTEXT === "production" || databaseHost === "localhost" || databaseHost === "127.0.0.1";
}

// ------------------------------------------------------------------- WhatsApp

/** A stored phone as an Iraqi international number (9647…); null when it isn't one. */
export function iraqiWhatsapp(phone: string | null | undefined) {
  let digits = String(phone ?? "").replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("964")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);

  return /^7\d{9}$/.test(digits) ? `964${digits}` : null;
}

export function firstName(name: string | null | undefined) {
  return String(name ?? "").trim().split(/\s+/)[0] || "";
}

export type ReminderData = {
  firstName: string;
  packageName: string;
  /** YYYY-MM-DD */
  endDate: string;
  points: number;
  discountLabel: string | null;
  renewUrl: string;
};

function dateText(day: string, lang: "ar" | "en") {
  const at = new Date(`${day.slice(0, 10)}T12:00:00Z`);

  return new Intl.DateTimeFormat(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Baghdad" }).format(at);
}

/** The prefilled message, in natural Iraqi Arabic (English when asked). */
export function renderReminder(template: Reminder, data: ReminderData, lang: "ar" | "en" = "ar") {
  const hi = data.firstName ? (lang === "ar" ? `هلا ${data.firstName} 👋` : `Hi ${data.firstName} 👋`) : lang === "ar" ? "هلا 👋" : "Hi 👋";
  const when = dateText(data.endDate, lang);
  const lines: string[] = [hi];

  if (lang === "ar") {
    if (template === "before-expiry") lines.push(`اشتراكك «${data.packageName}» ينتهي بعد 5 أيام (${when}).`, "جدده من هسه حتى ما ينقطع عنك.");
    if (template === "expiry-day") lines.push(`اشتراكك «${data.packageName}» ينتهي اليوم (${when}).`, "جدده هسه حتى تبقى تتفرج بدون انقطاع.");
    if (template === "win-back") lines.push(`اشتراكك «${data.packageName}» خلص من 3 أيام (${when}).`, "اشتقنالك! تكدر ترجع تفعّله بسهولة.");
    if (data.points > 0) lines.push(`وعندك ${data.points} نقطة بنقاط شاشتنا.`);
    if (data.discountLabel) lines.push(`وهسه التجديد عليه ${data.discountLabel}.`);
    lines.push(`رابط التجديد: ${data.renewUrl}`, "فريق شاشتنا");
  } else {
    if (template === "before-expiry") lines.push(`Your «${data.packageName}» subscription ends in 5 days (${when}).`, "Renew now so it doesn't stop.");
    if (template === "expiry-day") lines.push(`Your «${data.packageName}» subscription ends today (${when}).`, "Renew now to keep watching.");
    if (template === "win-back") lines.push(`Your «${data.packageName}» subscription ended 3 days ago (${when}).`, "We miss you! Reactivating is easy.");
    if (data.points > 0) lines.push(`You also have ${data.points} Shashtna points.`);
    if (data.discountLabel) lines.push(`Renewal is on offer right now: ${data.discountLabel}.`);
    lines.push(`Renew here: ${data.renewUrl}`, "The Shashtna team");
  }

  return lines.join("\n");
}

export function waLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

// ------------------------------------------------------------------- settings

export const AUTOMATION_SWITCHES = ["automation.enabled", "automation.dryRun", "automation.job.dailyDigest"] as const;

/** Server validation of the automation settings (on / off, and the quiet-hours range). */
export function automationSettingProblem(key: string, value: string): string | null {
  if ((AUTOMATION_SWITCHES as readonly string[]).includes(key)) return value === "on" || value === "off" ? null : "القيمة مفعّل أو متوقف.";
  if (key === "automation.quietHours") return /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.test(value.trim()) ? null : "وقت الراحة بصيغة 22:00-09:00.";

  return null;
}
