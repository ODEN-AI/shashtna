"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { buttonClass } from "./Button";

/** Submit button that disables itself while its form's action runs, so a
 * double tap never submits twice. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  disabled,
  name,
  value,
  pending: pendingOverride,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glow";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  /** For forms submitted from onSubmit (no form action), which useFormStatus can't see. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
      className={buttonClass(variant, size, className)}
    >
      {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
