import type { Metadata } from "next";

import { NotFoundContent } from "@/app/components/NotFoundContent";
import { Logo } from "@/app/ui/Logo";

export const metadata: Metadata = { title: "الصفحة غير موجودة", robots: { index: false } };

// Unmatched URLs (outside any section) render here, inside the root layout.
export default function NotFound() {
  return (
    <div className="bg-cinema min-h-dvh">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <Logo />
      </div>
      <NotFoundContent />
    </div>
  );
}
