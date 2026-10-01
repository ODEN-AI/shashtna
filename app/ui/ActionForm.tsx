"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";

import { announceSessionExpired } from "./session-events";
import { Notice } from "./States";
import { useToast } from "./Toast";

/** `code` is UNAUTHENTICATED (session gone, 401) or FORBIDDEN (no permission, 403) when set. */
export type ActionFormState = { ok: boolean; message: string; code?: string } | null;

/**
 * A form bound to a server action that returns `{ ok, message }`. Errors are
 * shown inline next to the fields; successes show a toast and can reset the
 * form (e.g. after sending a reply).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: ActionFormState, formData: FormData) => Promise<ActionFormState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const { t } = useLanguage();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (state?.code === "UNAUTHENTICATED") {
      announceSessionExpired();
    }

    if (state?.ok) {
      if (state.message) {
        toast(state.message);
      }

      if (resetOnSuccess) {
        ref.current?.reset();
      }
    }
  }, [state, toast, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        // Don't send while offline: say so instead of failing mid-request.
        const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
        setOffline(isOffline);

        if (isOffline) {
          event.preventDefault();
        }
      }}
    >
      {offline ? (
        <Notice tone="danger" className="mb-4">
          {t("تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.", "Can't reach the server. Check your internet connection and try again.")}
        </Notice>
      ) : state && !state.ok ? (
        <Notice tone="danger" className="mb-4">{state.message}</Notice>
      ) : null}
      {children}
    </form>
  );
}
