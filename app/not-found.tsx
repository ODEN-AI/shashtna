import type { Metadata } from "next";

import s from "@/app/components/home/home.module.css";
import { NotFoundContent } from "@/app/components/NotFoundContent";
import tone from "@/app/components/site/tone.module.css";
import { Logo } from "@/app/ui/Logo";

export const metadata: Metadata = { title: "الصفحة غير موجودة", robots: { index: false } };

// Unmatched URLs (outside any section) render here, inside the root layout
// (no site header), on the site's navy ground.
export default function NotFound() {
  return (
    <div className={`${s.home} ${tone.tone} min-h-dvh`}>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <Logo />
      </div>
      <NotFoundContent />
    </div>
  );
}
