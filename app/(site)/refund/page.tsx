import type { Metadata } from "next";

import { LegalPage } from "@/app/components/site/LegalPage";
import { REFUND_DRAFT } from "@/src/content/legal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "سياسة الاسترجاع",
  alternates: { canonical: "/refund" },
};

export default function Page() {
  return <LegalPage settingKey="legal.refund" titleAr="سياسة الاسترجاع" titleEn="Refund policy" draft={REFUND_DRAFT} />;
}
