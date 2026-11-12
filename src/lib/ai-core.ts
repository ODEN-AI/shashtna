import { hasPermission, type Permission } from "@/src/lib/roles";

/**
 * SHASHTNA AI CORE — pure rules (phase 5, step 1). No database, no network.
 *
 * An agent is a fixed system prompt plus a fixed list of TOOLS. A tool is a
 * read-only server function with a permission, a data class and a strict
 * input schema. The model only ever sees what a tool returns, after masking.
 *
 * Rules (docs/ai-core.md):
 * - Step 1 tools only READ. Nothing an agent does changes data; proposals
 *   that need the owner's approval come in a later step.
 * - A tool runs only if the asking staff member's role holds its permission
 *   (checked again on the server for every call, never trusted from the model).
 * - Data classes: AGGREGATE (counts and sums) and OPERATIONAL (order ids,
 *   statuses, package names — no names, phones, e-mails, credentials or
 *   payment proofs). CUSTOMER data (step 4, owner-approved 2026-11-13) is one
 *   customer's ticket and service status, and only inside a TICKET SCOPE:
 *   the run is about one support ticket and the tool reads that ticket's
 *   customer only. Still never names, phones, credentials, proofs or receipts.
 * - Every tool result is masked (phones, e-mails, long digit runs) and capped
 *   before it reaches the model.
 * - A run is bounded: at most MAX_TURNS model turns and MAX_TOOL_CALLS calls.
 */

export const AI_MODEL = "claude-opus-5-5";

/** Model turns per run (each turn may call several tools). */
export const MAX_TURNS = 6;
/** Tool calls per run, across all turns. */
export const MAX_TOOL_CALLS = 12;
/** Characters of one tool result sent to the model. */
export const MAX_RESULT_CHARS = 12_000;
/** Characters of the staff member's question. */
export const MAX_QUESTION_CHARS = 1_000;

export const DATA_CLASSES = ["AGGREGATE", "OPERATIONAL", "CUSTOMER"] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

/** Data classes any run may use. CUSTOMER needs a ticket scope as well (canUseTool). */
export const ALLOWED_DATA_CLASSES: readonly DataClass[] = ["AGGREGATE", "OPERATIONAL"];

/** What a run is about. A CUSTOMER tool runs only with a ticket scope. */
export type RunScope = { ticketId?: string | null };

/** The subset of JSON Schema the core accepts for tool inputs (validated on the server). */
export type InputProperty =
  | { type: "string"; enum: readonly string[]; description?: string }
  | { type: "integer"; minimum: number; maximum: number; description?: string };

export type InputSchema = {
  type: "object";
  properties: Record<string, InputProperty>;
  required: readonly string[];
  additionalProperties: false;
};

export type ToolSpec = {
  name: string;
  description: string;
  permission: Permission;
  dataClass: DataClass;
  input: InputSchema;
};

export const AGENTS = ["operations", "finance", "customer"] as const;
export type AgentId = (typeof AGENTS)[number];

/** Agents that work on one support ticket (opened from the ticket page, never from the assistants page). */
export const TICKET_AGENTS: readonly AgentId[] = ["customer"];

/** Ticket ids as the support store makes them (letters, digits, dashes, underscores). */
export function isTicketId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(value);
}

export function isAgentId(value: unknown): value is AgentId {
  return (AGENTS as readonly string[]).includes(String(value));
}

/** Tool names are short snake_case identifiers (the API's limit is 64). */
export function isValidToolName(name: string) {
  return /^[a-z][a-z0-9_]{1,40}$/.test(name);
}

/**
 * Whether a staff role may use a tool in this run: the role holds the tool's
 * permission, and its data class is allowed — CUSTOMER only inside a ticket scope.
 */
export function canUseTool(role: unknown, tool: Pick<ToolSpec, "permission" | "dataClass">, scope: RunScope = {}) {
  if (!hasPermission(role, tool.permission)) return false;
  if (tool.dataClass === "CUSTOMER") return isTicketId(scope.ticketId);

  return ALLOWED_DATA_CLASSES.includes(tool.dataClass);
}

/** The tools of a list the role may use in this run; the model is never shown the others. */
export function toolsFor<T extends Pick<ToolSpec, "permission" | "dataClass">>(role: unknown, tools: readonly T[], scope: RunScope = {}) {
  return tools.filter((tool) => canUseTool(role, tool, scope));
}

export type InputCheck = { ok: true; value: Record<string, string | number> } | { ok: false; error: string };

/**
 * Validates a tool call's input against its schema: only declared keys,
 * required keys present, enums matched exactly, integers whole and in range.
 * Never trust the model's arguments.
 */
export function checkToolInput(schema: InputSchema, input: unknown): InputCheck {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "input must be an object" };

  const record = input as Record<string, unknown>;
  const value: Record<string, string | number> = {};

  for (const key of Object.keys(record)) {
    if (!(key in schema.properties)) return { ok: false, error: `unknown field: ${key.slice(0, 40)}` };
  }

  for (const key of schema.required) {
    if (record[key] === undefined || record[key] === null) return { ok: false, error: `missing field: ${key}` };
  }

  for (const [key, property] of Object.entries(schema.properties)) {
    const raw = record[key];

    if (raw === undefined || raw === null) continue;

    if (property.type === "string") {
      if (typeof raw !== "string" || !property.enum.includes(raw)) return { ok: false, error: `${key} must be one of: ${property.enum.join(", ")}` };
      value[key] = raw;
    } else {
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < property.minimum || raw > property.maximum) {
        return { ok: false, error: `${key} must be a whole number from ${property.minimum} to ${property.maximum}` };
      }
      value[key] = raw;
    }
  }

  return { ok: true, value };
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
// Iraqi mobiles in local or international form, any other +country number, and long digit runs (card / account numbers).
const PHONE = /(?:\+|00)?964[\s-]?7\d{2}[\s-]?\d{3}[\s-]?\d{4}|\b0?7\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|\+\d{8,15}\b|\b\d{11,}\b/g;
/** Keys whose values never leave the server, whatever a tool returns. */
const SECRET_KEYS = /^(phone|mobile|whatsapp|email|e_?mail|password|pass|secret|token|credentials?|username|iptv_?user(name)?|iptv_?pass(word)?|proof|receipt|address|name|customer_?name|full_?name)$/i;

/** Masks contact details and drops sensitive keys anywhere in a tool result. */
export function maskForModel(value: unknown, depth = 0): unknown {
  if (depth > 8) return "…";
  if (typeof value === "string") return value.replace(EMAIL, "…@…").replace(PHONE, "…");
  if (Array.isArray(value)) return value.map((item) => maskForModel(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(key)) continue;
      out[key] = maskForModel(item, depth + 1);
    }

    return out;
  }

  return value;
}

/** A tool result as the model sees it: masked JSON, capped in length (marked when cut). */
export function toolResultText(value: unknown) {
  const text = JSON.stringify(maskForModel(value));

  return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…[truncated]` : text;
}

/** The staff member's question: trimmed, capped, never empty. */
export function cleanQuestion(question: unknown) {
  const text = String(question ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_CHARS);

  return text || null;
}

export type RunBudget = { turns: number; toolCalls: number };

/** Whether another model turn may start. */
export function canContinue(budget: RunBudget) {
  return budget.turns < MAX_TURNS && budget.toolCalls < MAX_TOOL_CALLS;
}

/** How many of the requested tool calls this turn may still run (the rest get an error result). */
export function allowedCalls(budget: RunBudget, requested: number) {
  return Math.max(0, Math.min(requested, MAX_TOOL_CALLS - budget.toolCalls));
}

/** The audit trace of one tool call: name, checked input and outcome. Never the result itself. */
export type ToolTrace = { tool: string; input: Record<string, string | number> | null; ok: boolean; error?: string; ms: number };

/** Short audit summary of a run (activity log). */
export function traceSummary(trace: readonly ToolTrace[]) {
  if (!trace.length) return "بدون أدوات";

  return trace.map((call) => `${call.tool}${call.ok ? "" : " ✗"}`).join("، ");
}
