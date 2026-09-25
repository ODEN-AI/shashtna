"use client";

import { useEffect, useRef } from "react";

const KEY = "shashtna:proof-sent";

/** Called when a proof is sent, so the page that re-renders can show the result. */
export function markProofSent(orderId: number) {
  try {
    window.sessionStorage.setItem(KEY, String(orderId));
  } catch {
    // Storage can be unavailable; the page still updates, just without scrolling.
  }
}

/**
 * Placed in the "proof received" card. After an upload the payment section
 * disappears and the page gets shorter, which can leave the customer looking
 * at the footer; this brings the confirmation into view once.
 */
export function ProofReceivedAnchor({ orderId }: { orderId: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEY) !== String(orderId)) {
        return;
      }

      window.sessionStorage.removeItem(KEY);
    } catch {
      return;
    }

    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [orderId]);

  return <span ref={ref} aria-hidden className="block" />;
}
