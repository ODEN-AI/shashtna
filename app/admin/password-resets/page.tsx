import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";

import { dismissResetAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ResetCodeForm } from "@/app/components/admin/ResetCodeForm";
import { StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState, Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { customersById } from "@/src/server/admin-data";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إعادة تعيين كلمات المرور" };

export default async function PasswordResetsPage() {
  const { allowed } = await requireStaffPage("/admin/password-resets", "customers");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const resets = await db.orm.public.PasswordReset.orderBy((reset) => reset.id.desc()).limit(100).all();
  const customers = await customersById(resets.map((reset) => reset.userId));
  const labels: Record<string, string> = {
    REQUESTED: t("بانتظار التحقق", "Awaiting verification"),
    ISSUED: t("تم إصدار رمز", "Code issued"),
    USED: t("تم الاستخدام", "Used"),
    DISMISSED: t("مغلق", "Dismissed"),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("إعادة تعيين كلمات المرور", "Password resets")} />
      <Notice tone="warning" title={t("تحقق من الهوية أولًا", "Verify identity first")}>
        {t(
          "اتصل بالعميل على رقمه المسجل وتأكد إنه صاحب الحساب قبل إصدار الرمز. لا ترسل الرمز لرقم غير المسجل.",
          "Call the customer on the registered number and confirm they own the account before issuing a code. Never send the code to a different number.",
        )}
      </Notice>
      {resets.length ? (
        <ul className="space-y-3">
          {resets.map((reset) => {
            const customer = customers.get(reset.userId);
            const open = reset.status === "REQUESTED" || reset.status === "ISSUED";

            return (
              <li key={reset.id} className="surface rounded-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/customers/${reset.userId}`} className="font-bold text-ink hover:text-brand-ink">
                      {customer?.name ?? `#${reset.userId}`}
                    </Link>
                    <p className="nums text-sm text-ink-2" dir="ltr">{customer?.phone}</p>
                    <p className="nums mt-1 text-xs text-ink-3">{formatDateTime(reset.createdAt, lang)}</p>
                  </div>
                  <StatusBadge status={reset.status} label={labels[reset.status] ?? reset.status} />
                </div>
                {open ? (
                  <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-line pt-4">
                    {customer ? (
                      <LinkButton href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} external variant="secondary" size="sm">
                        <Phone size={15} aria-hidden />
                        {t("اتصال", "Call")}
                      </LinkButton>
                    ) : null}
                    <ResetCodeForm resetId={reset.id} reissue={reset.status === "ISSUED"} />
                    <form action={dismissResetAction}>
                      <input type="hidden" name="resetId" value={reset.id} />
                      <SubmitButton size="sm" variant="ghost">{t("إغلاق الطلب", "Dismiss")}</SubmitButton>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={t("ماكو طلبات", "No requests")} />
      )}
    </div>
  );
}
