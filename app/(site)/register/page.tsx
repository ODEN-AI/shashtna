import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/app/components/auth/AuthShell";
import { RegisterForm } from "@/app/components/auth/RegisterForm";
import { postAuthDestination } from "@/src/lib/redirect";
import { getSessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const metadata: Metadata = {
  title: "إنشاء حساب",
  robots: { index: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const destination = postAuthDestination(params);
  const [{ t }, user] = await Promise.all([getI18n(), getSessionUser().catch(() => null)]);

  if (user) {
    redirect(destination);
  }

  return (
    <AuthShell
      title={t("إنشاء حساب", "Create your account")}
      description={
        destination.startsWith("/checkout")
          ? t("خطوة وحدة وتكمل طلبك — اختيارك محفوظ.", "One step and you'll continue your order — your choice is saved.")
          : t("أنشئ حسابك حتى تطلب اشتراكك وتتابعه.", "Create your account to order and manage your subscription.")
      }
      footer={
        <>
          {t("عندك حساب؟ ", "Already have an account? ")}
          <Link href={`/login?redirect=${encodeURIComponent(destination)}`} className="font-bold text-brand-ink hover:text-ink">
            {t("سجّل دخولك", "Sign in")}
          </Link>
        </>
      }
    >
      <RegisterForm destination={destination} />
    </AuthShell>
  );
}
