import type { Metadata } from "next";

import { LegalPage } from "@/app/components/site/LegalPage";
import { PRIVACY_DRAFT } from "@/src/content/legal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <LegalPage settingKey="legal.privacy" titleAr="سياسة الخصوصية" titleEn="Privacy policy" draft={PRIVACY_DRAFT} />;
}
