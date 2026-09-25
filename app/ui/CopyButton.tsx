"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { useToast } from "./Toast";

export function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast(copiedLabel);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          toast(label, "error");
        }
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-3 hover:text-ink"
      aria-label={label}
    >
      {copied ? <Check size={16} className="text-success" aria-hidden /> : <Copy size={16} aria-hidden />}
    </button>
  );
}

/** A credential row: masked until the customer chooses to reveal it. */
export function SecretValue({
  value,
  showLabel,
  hideLabel,
  copyLabel,
  copiedLabel,
}: {
  value: string;
  showLabel: string;
  hideLabel: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="flex items-center gap-1">
      <span className="nums min-w-0 truncate font-mono text-sm text-ink" dir="ltr">
        {visible ? value : "••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-3 hover:text-ink"
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
      <CopyButton value={value} label={copyLabel} copiedLabel={copiedLabel} />
    </span>
  );
}
