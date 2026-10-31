/**
 * Plan groups — pure parts (unit-tested).
 *
 * Packages are shown on /plans in groups: the built-in IPTV and VIP groups and
 * the digital platforms the owner adds (Netflix, beIN Sports, …). A digital
 * group's packages have serviceType DIGITAL; each package is one subscription
 * type (Premium 4K, Basic…) with its lengths as options. Delivery is per group:
 * a CODE (one-off), a ready ACCOUNT (e-mail + password) or the CUSTOMER_EMAIL
 * account the customer gives at checkout. Account deliveries become a
 * subscription that renews; a code never does.
 *
 * Colours are data the owner picks; they must stay readable on Shashtna's dark
 * UI (WCAG AA, 4.5:1), and are checked here before saving.
 */

export const DELIVERY_KINDS = ["CODE", "ACCOUNT", "CUSTOMER_EMAIL"] as const;
export type DeliveryKind = (typeof DELIVERY_KINDS)[number];

export const BUILT_IN_GROUPS = ["iptv", "vip"] as const;

export function normalizeDelivery(value: unknown): DeliveryKind {
  const kind = String(value ?? "").trim().toUpperCase();
  return (DELIVERY_KINDS as readonly string[]).includes(kind) ? (kind as DeliveryKind) : "ACCOUNT";
}

/** Account deliveries create a subscription with an expiry that can be renewed; a code is one-off. */
export function deliveryRenews(kind: DeliveryKind) {
  return kind === "ACCOUNT" || kind === "CUSTOMER_EMAIL";
}

export function isBuiltInGroup(slug: string) {
  return (BUILT_IN_GROUPS as readonly string[]).includes(slug);
}

// ------------------------------------------------------------------- contrast

/** The light and dark text the site draws on a group's colours (the theme's ink values). */
export const LIGHT_TEXT = "#f4f7ff";
export const DARK_TEXT = "#040a1c";
export const MIN_CONTRAST = 4.5;

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function parseHex(value: unknown): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? "").trim());

  if (!match) return null;

  const hex = match[1];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((part) => Math.round(Math.max(0, Math.min(255, part))).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(rgb: [number, number, number]) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrast(a: string, b: string) {
  const x = parseHex(a);
  const y = parseHex(b);

  if (!x || !y) return 0;

  const [hi, lo] = [luminance(x), luminance(y)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
}

/** The text colour a button in the accent colour uses: whichever reads better. */
export function buttonText(accent: string) {
  return contrast(accent, DARK_TEXT) >= contrast(accent, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
}

function mix(rgb: [number, number, number], target: number, amount: number): [number, number, number] {
  return [rgb[0] + (target - rgb[0]) * amount, rgb[1] + (target - rgb[1]) * amount, rgb[2] + (target - rgb[2]) * amount];
}

export type ContrastCheck = {
  ok: boolean;
  /** Accent text / badges on the surface. */
  accentOnSurface: number;
  /** Body text on the surface. */
  textOnSurface: number;
  /** The button label on the accent. */
  buttonLabel: number;
  /** A compliant pair when this one fails (null when it passes or can't be fixed). */
  suggestion: { accent: string; surface: string } | null;
};

function passes(accent: string, surface: string) {
  return contrast(accent, surface) >= MIN_CONTRAST && contrast(LIGHT_TEXT, surface) >= MIN_CONTRAST && contrast(accent, buttonText(accent)) >= MIN_CONTRAST;
}

/**
 * Checks a group's colours against the site's text and suggests the nearest
 * compliant shades: the surface darkened, then the accent lightened, in small
 * steps, keeping the owner's hue.
 */
export function checkColours(accent: string, surface: string): ContrastCheck {
  const a = parseHex(accent);
  const s = parseHex(surface);
  const report = {
    accentOnSurface: contrast(accent, surface),
    textOnSurface: contrast(LIGHT_TEXT, surface),
    buttonLabel: a ? contrast(accent, buttonText(accent)) : 0,
  };

  if (!a || !s) return { ok: false, ...report, suggestion: null };
  if (passes(accent, surface)) return { ok: true, ...report, suggestion: null };

  for (let dark = 0; dark <= 1.0001; dark += 0.05) {
    const surfaceTry = toHex(mix(s, 0, dark));

    for (let light = 0; light <= 1.0001; light += 0.05) {
      const accentTry = toHex(mix(a, 255, light));

      if (passes(accentTry, surfaceTry)) return { ok: false, ...report, suggestion: { accent: accentTry, surface: surfaceTry } };
    }
  }

  return { ok: false, ...report, suggestion: null };
}

/** Ready-made colour pairs offered in the dashboard (each passes checkColours). */
export const PALETTE = [
  { key: "red", ar: "أحمر", en: "Red", accent: "#ff5a64", surface: "#1a0b10" },
  { key: "blue", ar: "أزرق", en: "Blue", accent: "#5cc8ff", surface: "#06132e" },
  { key: "purple", ar: "بنفسجي", en: "Purple", accent: "#b69cff", surface: "#120b2a" },
  { key: "green", ar: "أخضر", en: "Green", accent: "#34d399", surface: "#05190f" },
  { key: "orange", ar: "برتقالي", en: "Orange", accent: "#ffa24c", surface: "#1c1006" },
  { key: "gold", ar: "ذهبي", en: "Gold", accent: "#f1cf7a", surface: "#161105" },
  { key: "silver", ar: "فضي", en: "Silver", accent: "#d7deea", surface: "#0e1220" },
] as const;

// ------------------------------------------------------------------- admin input

export type GroupInput = {
  name: string;
  nameEn: string | null;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  isActive: boolean;
  accent: string;
  surface: string;
  delivery: DeliveryKind;
};

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function safeUrl(value: unknown) {
  const url = text(value, 500);
  return !url ? null : /^https:\/\//.test(url) || /^\/[\w\-./]+$/.test(url) ? url : false;
}

/** Server validation of a digital group from the dashboard (built-in groups keep their slug and service). */
export function parseGroup(input: Record<string, unknown>): { ok: true; value: GroupInput } | { ok: false; error: string } {
  const name = text(input.name, 80);

  if (name.length < 2) return { ok: false, error: "اكتب اسم المجموعة." };

  const slug = text(input.slug, 40).toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, error: "الرابط المختصر حروف إنكليزية صغيرة وأرقام وشرطات بس (مثال netflix)." };

  const logoUrl = safeUrl(input.logoUrl);

  if (logoUrl === false) return { ok: false, error: "رابط الشعار يجب أن يبدأ بـ https:// أو يكون صورة مرفوعة." };

  const sortText = text(input.sortOrder, 6) || "0";

  if (!/^\d{1,4}$/.test(sortText)) return { ok: false, error: "الترتيب رقم صحيح من 0 إلى 9999." };

  const accent = text(input.accent, 7).toLowerCase();
  const surface = text(input.surface, 7).toLowerCase();

  if (!parseHex(accent) || !parseHex(surface) || !accent.startsWith("#") || !surface.startsWith("#")) {
    return { ok: false, error: "الألوان بصيغة #RRGGBB." };
  }

  const check = checkColours(accent, surface);

  if (!check.ok) {
    return {
      ok: false,
      error: check.suggestion
        ? `الألوان ما تنقرا زين على خلفية الموقع الداكنة. جرّب: اللون ${check.suggestion.accent} والخلفية ${check.suggestion.surface}.`
        : "الألوان ما تنقرا زين على خلفية الموقع الداكنة. اختار لون أفتح وخلفية أغمق.",
    };
  }

  const delivery = String(input.delivery ?? "").toUpperCase();

  if (!(DELIVERY_KINDS as readonly string[]).includes(delivery)) return { ok: false, error: "اختر طريقة التسليم." };

  return {
    ok: true,
    value: {
      name,
      nameEn: text(input.nameEn, 80) || null,
      slug,
      logoUrl,
      description: text(input.description, 300) || null,
      descriptionEn: text(input.descriptionEn, 300) || null,
      sortOrder: Number(sortText),
      isActive: input.isActive === true || input.isActive === "on" || input.isActive === "true",
      accent,
      surface,
      delivery: delivery as DeliveryKind,
    },
  };
}

/** The account e-mail a CUSTOMER_EMAIL group asks for at checkout. */
export function parseDeliveryEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase().slice(0, 254);

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Points a digital platform order earns by default: 1 per 5,000 IQD (owner decision), rounded down. */
export const DIGITAL_POINT_VALUE_IQD = 5000;
