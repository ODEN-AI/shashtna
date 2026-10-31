import type { Metadata } from "next";
import Link from "next/link";
import { Percent } from "lucide-react";

import { CatalogueHeader } from "@/app/components/admin/catalogue/CatalogueUI";
import { EmptyLine, SectionCard } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { discountAmount } from "@/src/lib/discounts";
import { formatDateTime, formatPrice } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { listCurrentDiscounts } from "@/src/server/discounts";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الخصومات — الكتالوج" };

/** Active and scheduled discounts across the catalogue; each is edited from its package. */
export default async function DiscountsPage() {
  const { allowed } = await requireStaffPage("/admin/catalogue/discounts", "catalogue");

  if (!allowed) return <Forbidden />;

  const [{ t, lang }, rows] = await Promise.all([getI18n(), listCurrentDiscounts()]);

  return (
    <div className="space-y-5" data-testid="catalogue-discounts-list">
      <CatalogueHeader
        active="discounts"
        t={t}
        title={t("الخصومات", "Discounts")}
        description={t("الخصومات الفعّالة والمجدولة. تعديلها أو إنهاؤها من صفحة الباقة.", "Active and scheduled discounts. Edit or end them from the package page.")}
      />
      <SectionCard title={t("الفعّالة والمجدولة", "Active and scheduled")} icon={<Percent size={14} aria-hidden />}>
        {rows.length ? (
          <ul className="divide-y divide-line/70">
            {rows.map((row) => {
              const price = row.option?.price ?? 0;

              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" data-testid="discount-row" data-status={row.status}>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {row.pkg ? (
                        <Link href={`/admin/catalogue/packages/${row.pkg.id}`} className="hover:underline">
                          {row.pkg.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      <span className="text-ink-3">· {row.option?.durationLabel ?? "—"}</span>
                      <Badge tone={row.status === "ACTIVE" ? "success" : "info"}>{row.status === "ACTIVE" ? t("فعّال", "Active") : t("مجدول", "Scheduled")}</Badge>
                      {row.appliesToRenewals ? <Badge tone="neutral">{t("يشمل التجديد", "Renewals too")}</Badge> : null}
                    </span>
                    <span className="nums block text-xs text-ink-3">
                      {row.startsAt ? `${t("من", "From")} ${formatDateTime(row.startsAt, lang)}` : t("من الإضافة", "Since added")}
                      {" · "}
                      {row.endsAt ? `${t("لحد", "Until")} ${formatDateTime(row.endsAt, lang)}` : t("بدون نهاية", "No end date")}
                    </span>
                  </span>
                  <span className="nums text-end">
                    <span className="block font-bold text-success">{row.kind === "PERCENT" ? `${row.value}%` : formatPrice(row.value, lang)}</span>
                    <span className="block text-xs text-ink-3">
                      <span className="line-through">{formatPrice(price, lang)}</span> → {formatPrice(price - discountAmount(price, row), lang)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyLine>{t("ماكو خصومات فعّالة أو مجدولة.", "No active or scheduled discounts.")}</EmptyLine>
        )}
      </SectionCard>
    </div>
  );
}
