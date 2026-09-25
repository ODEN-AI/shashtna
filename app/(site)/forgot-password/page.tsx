import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/app/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/app/components/auth/ResetForms";
import { getI18n } from "@/src/server/i18n";

export const metadata: Metadata = { title: "نسيت كلمة المرور", robots: { index: false } };

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();

  return (
    <AuthShell
      title={t("نسيت كلمة المرور؟", "Forgot your password?")}
      description={t(
        "اكتب رقم هاتفك. فريقنا يتأكد من هويتك ويعطيك رمز لتعيين كلمة مرور جديدة.",
        "Enter your phone number. Our team verifies it's you and gives you a code to set a new password.",
      )}
      footer={
        <Link href="/login" className="font-bold text-brand-ink hover:text-ink">
          {t("رجوع لتسجيل الدخول", "Back to sign in")}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
