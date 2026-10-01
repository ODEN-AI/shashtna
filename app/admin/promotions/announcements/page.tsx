import type { Metadata } from "next";

import { ContentListPage } from "@/app/components/admin/promotions/ContentListPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "العروض والمحتوى" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; placement?: string; audience?: string; page?: string }> }) {
  return <ContentListPage group="announcements" params={await searchParams} />;
}
