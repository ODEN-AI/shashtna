"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

import { Notice } from "./States";
import { useToast } from "./Toast";

export type ActionFormState = { ok: boolean; message: string } | null;

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

  useEffect(() => {
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
    <form ref={ref} action={formAction} className={className}>
      {state && !state.ok ? <Notice tone="danger" className="mb-4">{state.message}</Notice> : null}
      {children}
    </form>
  );
}
