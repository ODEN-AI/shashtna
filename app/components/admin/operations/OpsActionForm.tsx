"use client";

import { useActionState, type ReactNode } from "react";

import { Notice } from "@/app/ui/States";
import { announceSessionExpired } from "@/app/ui/session-events";
import { useToast } from "@/app/ui/Toast";

type State = { ok: boolean; message: string; code?: string } | null;

/**
 * Form for Operations Center actions. Same server actions as the rest of
 * the admin; the difference is that success is announced from the action
 * callback itself, because a successful action usually removes the item
 * from its queue (and this form with it) in the same re-render — the
 * operator still sees what happened.
 */
export function OpsActionForm({
  action,
  children,
  className,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children: ReactNode;
  className?: string;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(async (previous: State, formData: FormData) => {
    const result = await action(previous, formData);

    if (result?.ok && result.message) toast(result.message);
    if (result?.code === "UNAUTHENTICATED") announceSessionExpired();

    return result;
  }, null);

  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok ? (
        <Notice tone="danger" className="mt-2 w-full">
          {state.message}
        </Notice>
      ) : null}
    </form>
  );
}
