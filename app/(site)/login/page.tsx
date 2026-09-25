import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/app/components/auth/AuthShell";
import { LoginForm } from "@/app/components/auth/LoginForm";
import { Notice } from "@/app/ui/States";
import { postAuthDestination } from "@/src/lib/redirect";
import { getSessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; plan?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const destination = postAuthDestination(params);
  const [{ t }, user] = await Promise.all([getI18n(), getSessionUser().catch(() => null)]);

  if (user) {
    redirect(destination);
  }

  const toCheckout = destination.startsWith("/checkout");
  const registerHref = `/register?redirect=${encodeURIComponent(destination)}`;

  return (
    <AuthShell
      title={t("تسجيل الدخول", "Sign in")}
      description={
        toCheckout
          ? t("سجّل دخولك حتى نكمل طلبك — اختيارك محفوظ.", "Sign in to continue your order — your choice is saved.")
          : t("ادخل لحسابك حتى تدير اشتراكك وطلباتك.", "Sign in to manage your subscription and orders.")
      }
      footer={
        <>
          {t("ما عندك حساب؟ ", "New to Shashtna? ")}
          <Link href={registerHref} className="font-bold text-brand-ink hover:text-ink">
            {t("أنشئ حساب", "Create an account")}
          </Link>
        </>
      }
    >
      {params.reset === "1" ? (
        <Notice tone="success" className="mb-5">
          {t("تم تغيير كلمة المرور. سجّل دخولك بكلمة المرور الجديدة.", "Your password was changed. Sign in with the new one.")}
        </Notice>
      ) : null}
      <LoginForm destination={destination} />
    </AuthShell>
  );
}
