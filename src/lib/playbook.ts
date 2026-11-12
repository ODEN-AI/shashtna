/**
 * The owner's playbook — pure rules (phase 5, AI customer agent).
 *
 * The playbook is the ONLY source the customer-facing agent may answer from:
 * problems and their fixes, FAQ answers, how to pay, policies, device setup.
 * The owner writes it in Admin → Playbook. Disabled entries are kept and never
 * reach the agent. See docs/playbook.md.
 */

export const PLAYBOOK_KINDS = ["PROBLEM", "FAQ", "PAYMENT", "POLICY", "DEVICE"] as const;
export type PlaybookKind = (typeof PLAYBOOK_KINDS)[number];

export const PLAYBOOK_SERVICES = ["ALL", "IPTV", "VIP", "DIGITAL"] as const;
export type PlaybookService = (typeof PLAYBOOK_SERVICES)[number];

export const PLAYBOOK_KIND_LABELS: Record<PlaybookKind, { ar: string; en: string }> = {
  PROBLEM: { ar: "مشكلة وحلها", en: "Problem and fix" },
  FAQ: { ar: "سؤال وجواب", en: "Question and answer" },
  PAYMENT: { ar: "الدفع", en: "Payment" },
  POLICY: { ar: "سياسة وقاعدة", en: "Policy and rule" },
  DEVICE: { ar: "الأجهزة والتطبيقات", en: "Devices and apps" },
};

export const PLAYBOOK_SERVICE_LABELS: Record<PlaybookService, { ar: string; en: string }> = {
  ALL: { ar: "كل الخدمات", en: "All services" },
  IPTV: { ar: "IPTV", en: "IPTV" },
  VIP: { ar: "VIP", en: "VIP" },
  DIGITAL: { ar: "المنصات الرقمية", en: "Digital platforms" },
};

export const PLAYBOOK_LIMITS = { title: 120, keywords: 300, content: 4000, sortOrder: 9999 } as const;

export type PlaybookInput = { kind: PlaybookKind; service: PlaybookService; title: string; keywords: string; content: string; sortOrder: number; isActive: boolean };

export type PlaybookCheck = { ok: true; value: PlaybookInput } | { ok: false; error: string };

/** Comma / Arabic-comma / newline separated keywords, trimmed, deduplicated, lower-cased. */
export function parseKeywords(raw: string) {
  return [...new Set(String(raw ?? "").split(/[,،\n]+/).map((word) => word.trim().toLowerCase()).filter(Boolean))];
}

/** Validates an entry from the admin form. Server-side; never trust the form. */
export function checkPlaybookEntry(input: Record<string, unknown>): PlaybookCheck {
  const kind = String(input.kind ?? "").toUpperCase();
  const service = String(input.service ?? "ALL").toUpperCase();
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim();
  const content = String(input.content ?? "").replace(/\r\n/g, "\n").trim();
  const keywords = parseKeywords(String(input.keywords ?? "")).join("، ");
  const sortRaw = String(input.sortOrder ?? "0").trim() || "0";
  const sortOrder = Number(sortRaw);
  const active = String(input.isActive ?? "on");

  if (!(PLAYBOOK_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "اختار نوع صحيح." };
  if (!(PLAYBOOK_SERVICES as readonly string[]).includes(service)) return { ok: false, error: "اختار خدمة صحيحة." };
  if (title.length < 2 || title.length > PLAYBOOK_LIMITS.title) return { ok: false, error: `العنوان من 2 إلى ${PLAYBOOK_LIMITS.title} حرف.` };
  if (content.length < 5 || content.length > PLAYBOOK_LIMITS.content) return { ok: false, error: `المحتوى من 5 إلى ${PLAYBOOK_LIMITS.content} حرف.` };
  if (keywords.length > PLAYBOOK_LIMITS.keywords) return { ok: false, error: `الكلمات المفتاحية لحد ${PLAYBOOK_LIMITS.keywords} حرف.` };
  if (!/^\d+$/.test(sortRaw) || sortOrder > PLAYBOOK_LIMITS.sortOrder) return { ok: false, error: `الترتيب رقم صحيح من 0 إلى ${PLAYBOOK_LIMITS.sortOrder}.` };
  if (active !== "on" && active !== "off") return { ok: false, error: "الحالة مفعّل أو متوقف." };

  return { ok: true, value: { kind: kind as PlaybookKind, service: service as PlaybookService, title, keywords, content, sortOrder, isActive: active === "on" } };
}

/** Arabic-aware normalisation for matching: drop tashkeel and tatweel, unify alef / yeh / teh marbuta forms. */
export function normalizeForMatch(text: string) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PlaybookRow = { id: number; kind: string; service: string; title: string; keywords: string; content: string; isActive: boolean; sortOrder: number };

/**
 * Active entries that match a query, best first. A keyword hit counts most,
 * then title words, then content words; words shorter than 2 letters are
 * ignored. `service` keeps that service's entries and the ALL ones.
 */
export function searchPlaybook<T extends PlaybookRow>(rows: readonly T[], query: string, options: { service?: string | null; kind?: string | null; limit?: number } = {}): T[] {
  const words = [...new Set(normalizeForMatch(query).split(" ").filter((word) => word.length >= 2))];
  const service = options.service ? String(options.service).toUpperCase() : null;
  const kind = options.kind ? String(options.kind).toUpperCase() : null;
  const pool = rows.filter((row) => row.isActive && (!service || row.service === "ALL" || row.service === service) && (!kind || row.kind === kind));

  if (!words.length) return [...pool].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).slice(0, options.limit ?? 8);

  const scored = pool
    .map((row) => {
      const keys = parseKeywords(row.keywords).map(normalizeForMatch);
      const title = normalizeForMatch(row.title);
      const content = normalizeForMatch(row.content);
      let score = 0;

      for (const word of words) {
        if (keys.some((key) => key === word || key.includes(word) || (word.length >= 4 && word.includes(key) && key.length >= 3))) score += 5;
        if (title.includes(word)) score += 3;
        if (content.includes(word)) score += 1;
      }

      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.sortOrder - b.row.sortOrder || a.row.id - b.row.id);

  return scored.slice(0, options.limit ?? 8).map((item) => item.row);
}
