/**
 * Typed client for the Shashtna Console API (/api/console/v1).
 *
 * Framework-free (fetch + AbortController only) so the future shells
 * (Capacitor Android, Tauri Windows) and tests can share it. It never stores
 * anything: the session is the HttpOnly cookie the server sets (sent with
 * `credentials: "include"`), and the device credential is passed in by the
 * caller from OS secure storage (Phase 10C/10D) and returned to the caller
 * once at registration — the client keeps no copy.
 */

import {
  CONSOLE_API_BASE,
  consoleErrorKind,
  type ConsoleErrorBody,
  type ConsoleErrorKind,
  type DeviceChangeResponse,
  type DeviceInput,
  type DevicesResponse,
  type ExchangeResponse,
  type LogoutResponse,
  type RegisterResponse,
  type SessionResponse,
  type SummaryResponse,
} from "@/src/lib/console-api";

export class ConsoleApiError extends Error {
  readonly kind: ConsoleErrorKind;
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  /** Seconds to wait before retrying (429). */
  readonly retryAfter?: number;

  constructor(init: { kind: ConsoleErrorKind; status: number; code: string; message: string; field?: string; retryAfter?: number }) {
    super(init.message);
    this.name = "ConsoleApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.field = init.field;
    this.retryAfter = init.retryAfter;
  }
}

export type ConsoleClientOptions = {
  /** Console origin, e.g. https://shashtna.netlify.app ("" = same origin). */
  baseUrl?: string;
  /** Per-request timeout (default 15 s). */
  timeoutMs?: number;
  /** Injected fetch (tests, native HTTP bridges). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Extra headers per request (e.g. a native layer that manages cookies itself). Never a password or AUTH_SECRET. */
  headers?: () => Record<string, string>;
  /** Called on every 401 so the shell can re-exchange or show sign-in. */
  onUnauthenticated?: (error: ConsoleApiError) => void;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/** Turn a non-2xx response into a typed error (tolerates non-JSON bodies). */
export async function toConsoleError(response: Response): Promise<ConsoleApiError> {
  let body: Partial<ConsoleErrorBody> = {};
  try {
    body = (await response.json()) as Partial<ConsoleErrorBody>;
  } catch {
    body = {};
  }
  const header = Number(response.headers.get("retry-after"));
  const retryAfter = typeof body.retryAfter === "number" ? body.retryAfter : Number.isFinite(header) && header > 0 ? header : undefined;

  return new ConsoleApiError({
    kind: consoleErrorKind(response.status),
    status: response.status,
    code: typeof body.code === "string" ? body.code : response.status >= 500 ? "SERVER_ERROR" : `HTTP_${response.status}`,
    message: typeof body.message === "string" ? body.message : "تعذر إكمال الطلب.",
    field: typeof body.field === "string" ? body.field : (response.headers.get("x-invalid-field") ?? undefined),
    retryAfter,
  });
}

export function createConsoleClient(options: ConsoleClientOptions = {}) {
  const base = `${(options.baseUrl ?? "").replace(/\/+$/, "")}${CONSOLE_API_BASE}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
      response = await doFetch(`${base}${path}`, {
        method,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json", ...(method === "POST" ? { "Content-Type": "application/json" } : {}), ...(options.headers?.() ?? {}) },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch {
      const timedOut = controller.signal.aborted;
      throw new ConsoleApiError({
        kind: timedOut ? "timeout" : "network",
        status: 0,
        code: timedOut ? "TIMEOUT" : "NETWORK",
        message: timedOut ? "انتهت مهلة الاتصال بالخادم." : "تعذر الاتصال بالخادم.",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const error = await toConsoleError(response);
      if (error.kind === "unauthenticated") options.onUnauthenticated?.(error);
      throw error;
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ConsoleApiError({ kind: "server", status: response.status, code: "INVALID_RESPONSE", message: "استجابة غير متوقعة من الخادم." });
    }
  }

  return {
    session: {
      /** Trade a device credential (from OS secure storage) for the session cookie. */
      exchange: (credential: string) => request<ExchangeResponse>("POST", "/session/exchange", { credential }),
      /** End this session (for a device session, the device must sign in again). */
      logout: () => request<LogoutResponse>("POST", "/session/logout", {}),
      /** Who is signed in and with which server-granted permissions. */
      current: () => request<SessionResponse>("GET", "/session"),
    },
    devices: {
      list: (scope: "mine" | "team" = "mine") => request<DevicesResponse>("GET", scope === "team" ? "/devices?scope=team" : "/devices"),
      /** Returns the device credential ONCE — hand it straight to OS secure storage. */
      register: (input: { platform: DeviceInput["platform"]; label: string; appVersion?: string | null; deviceId?: number | null }) =>
        request<RegisterResponse>("POST", "/devices/register", input),
      rename: (id: number, label: string) => request<DeviceChangeResponse>("POST", `/devices/${encodeURIComponent(String(id))}/rename`, { label }),
      revoke: (id: number) => request<DeviceChangeResponse>("POST", `/devices/${encodeURIComponent(String(id))}/revoke`, {}),
    },
    /** Home counts (and finance only for roles allowed to see it). */
    summary: () => request<SummaryResponse>("GET", "/summary"),
  };
}

export type ConsoleClient = ReturnType<typeof createConsoleClient>;
