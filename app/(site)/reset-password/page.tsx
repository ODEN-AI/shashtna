import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/app/components/auth/AuthShell";
import { ResetPasswordForm } from "@/app/components/auth/ResetForms";
import { getI18n } from "@/src/server/i18n";

export const metadata: Metadata = { title: "تعيين كلمة المرور", robots: { index: false } };

export default async function ResetPasswordPage() {
  const { t } = await getI18n();

  return (
    <AuthShell
      title={t("تعيين كلمة مرور جديدة", "Set a new password")}
      description={t("استخدم الرمز اللي استلمته من فريق شاشتنا.", "Use the code you received from the Shashtna team.")}
      footer={
        <Link href="/forgot-password" className="font-bold text-brand-ink hover:text-ink">
          {t("ما عندك رمز؟", "Don't have a code?")}
        </Link>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
