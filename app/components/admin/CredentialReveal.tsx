"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { adminFetch } from "@/app/components/admin/adminFetch";
import { cn } from "@/app/ui/cn";

const AUTO_HIDE_MS = 60_000;

/**
 * A subscription password, masked by default. "Show" asks the server for it
 * (an audited request); "Hide" drops it from memory. It also hides itself
 * after a minute. The password is never part of any list/lookup response.
 */
export function RevealPassword({ subscriptionId, hasPassword, className }: { subscriptionId: number; hasPassword: boolean; className?: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (value === null) return;
    const timer = window.setTimeout(() => setValue(null), AUTO_HIDE_MS);

    return () => window.clearTimeout(timer);
  }, [value]);

  if (!hasPassword) {
    return <span className={cn("text-slate-400", className)}>—</span>;
  }

  async function reveal() {
    setLoading(true);
    setError("");

    try {
      const response = await adminFetch(`/api/admin/subscriptions/${subscriptionId}/credentials`, { method: "POST", cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "تعذر إظهار كلمة المرور.");
      }

      setValue(String(data.credentials?.password ?? ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إظهار كلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)} data-testid="credential-reveal" data-subscription={subscriptionId}>
      <span className="font-black" dir="ltr" data-testid="credential-value">
        {value ?? "••••••••"}
      </span>
      <button
        type="button"
        onClick={value === null ? reveal : () => setValue(null)}
        disabled={loading}
        className="text-slate-400 transition hover:text-blue-600 disabled:opacity-50"
        title={value === null ? "إظهار كلمة المرور (يُسجَّل بسجل التدقيق)" : "إخفاء كلمة المرور"}
        aria-label={value === null ? "إظهار كلمة المرور (يُسجَّل بسجل التدقيق)" : "إخفاء كلمة المرور"}
        data-testid="credential-toggle"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : value === null ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
      {error ? <span className="text-xs font-semibold text-red-500" role="alert">{error}</span> : null}
    </span>
  );
}
