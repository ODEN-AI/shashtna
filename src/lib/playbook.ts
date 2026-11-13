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

export type PlaybookRow = { id: number; kind: string; service: string; title: string; keywords: string; content: string; isActive: boolean; sortOrder: number };

/** How much playbook text the agent reads in one go (inside the AI core's tool-result cap). */
export const PLAYBOOK_READ_BUDGET = 9_000;

export type PlaybookForModel =
  | { mode: "full"; entries: { id: number; kind: string; service: string; problem: string; alsoCalled?: string; answer: string }[] }
  | { mode: "index"; note: string; entries: { id: number; kind: string; service: string; problem: string; preview: string }[] };

/**
 * The playbook as the agent reads it: every active entry for the customer's
 * service (and ALL), in the owner's order. The agent matches the customer's
 * own description to the right problem by meaning, not by shared words, so it
 * gets the whole text. When the playbook outgrows `budget`, it gets an index
 * (problem + a short preview) and opens entries by id.
 */
export function playbookForModel(rows: readonly PlaybookRow[], service: string | null = null, budget: number = PLAYBOOK_READ_BUDGET): PlaybookForModel {
  const wanted = service ? service.toUpperCase() : null;
  const pool = rows
    .filter((row) => row.isActive && (!wanted || row.service === "ALL" || row.service === wanted))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const full = pool.map((row) => ({ id: row.id, kind: row.kind, service: row.service, problem: row.title, ...(row.keywords ? { alsoCalled: row.keywords } : {}), answer: row.content }));

  if (JSON.stringify(full).length <= budget) return { mode: "full", entries: full };

  return {
    mode: "index",
    note: "The playbook is long: this is its index. Pick the entry (or entries) that describe the customer's problem, then read each with playbook_entry.",
    entries: pool.map((row) => ({ id: row.id, kind: row.kind, service: row.service, problem: row.title, preview: row.content.replace(/\s+/g, " ").slice(0, 90) })),
  };
}
