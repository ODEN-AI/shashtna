"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "./cn";

/**
 * Modal dialog built on the native <dialog> element: focus trapping, Escape
 * to close and the backdrop come from the browser. `variant="drawer"` slides
 * up from the bottom on phones (a bottom sheet) and is centred on desktop.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "modal",
  closeLabel = "إغلاق",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "modal" | "drawer";
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className={cn(
        "m-0 max-h-[92dvh] w-full max-w-none overflow-hidden border border-line-strong bg-surface-2 p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        variant === "drawer"
          ? "mt-auto rounded-t-[1.75rem] sm:m-auto sm:max-w-lg sm:rounded-panel"
          : "m-auto w-[calc(100%-2rem)] max-w-lg rounded-panel",
      )}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm leading-6 text-ink-3">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-3 hover:bg-surface-3 hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </dialog>
  );
}
