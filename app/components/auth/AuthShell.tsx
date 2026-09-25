import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { LogoImage } from "@/app/ui/Logo";
import { getI18n } from "@/src/server/i18n";

export async function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = await getI18n();

  return (
    <section className="bg-cinema min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1fr_440px] lg:px-8">
        <div className="hidden lg:block">
          <LogoImage className="h-20" />
          <h2 className="mt-8 max-w-md text-balance text-3xl font-bold leading-tight text-ink">
            {t("حساب واحد لاشتراكك وطلباتك ودعمك.", "One account for your subscription, orders and support.")}
          </h2>
          <ul className="mt-8 space-y-4 text-[15px] text-ink-2">
            {[
              t("تابع اشتراكك وتاريخ انتهائه", "Follow your subscription and its expiry"),
              t("جدّد بخطوتين وتابع طلبك", "Renew in two steps and track your order"),
              t("بيانات الدخول والإيصالات بمكان واحد", "Login details and receipts in one place"),
              t("تذاكر دعم مرتبطة باشتراكك", "Support tickets linked to your subscription"),
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 size={18} className="shrink-0 text-glow" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-raised w-full rounded-panel p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-7 text-ink-2">{description}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-2">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}
