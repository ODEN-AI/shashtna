import type { Metadata } from "next";

import { LegalPage } from "@/app/components/site/LegalPage";
import { TERMS_DRAFT } from "@/src/content/legal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الشروط والأحكام",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <LegalPage settingKey="legal.terms" titleAr="الشروط والأحكام" titleEn="Terms of service" draft={TERMS_DRAFT} />;
}
