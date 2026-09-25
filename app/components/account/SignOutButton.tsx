"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/app/components/site/SiteHeader";
import { buttonClass } from "@/app/ui/Button";

export function SignOutButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={signOut} className={buttonClass("danger")}>
      <LogOut size={16} aria-hidden />
      {label}
    </button>
  );
}
