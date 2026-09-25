"use client";

import { Printer } from "lucide-react";

import { buttonClass } from "./Button";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "md", "print:hidden")}>
      <Printer size={16} aria-hidden />
      {label}
    </button>
  );
}
