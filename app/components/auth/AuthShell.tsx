import { Check } from "lucide-react";
import type { ReactNode } from "react";

import s from "@/app/components/home/home.module.css";
import { ToneShell } from "@/app/components/site/ToneShell";
import { getI18n } from "@/src/server/i18n";

import a from "./auth.module.css";

/** Sign in, register and password reset: the account's benefits on a royal panel beside the form. */
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
    <ToneShell>
      <div className={`${s.wrap} ${a.frame}`}>
        <aside className={a.side}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/shashtna-logo-white-256.webp" alt="" className={a.logo} />
          <h2 className="text-balance">{t("حساب واحد لاشتراكك وطلباتك ودعمك.", "One account for your subscription, orders and support.")}</h2>
          <ul className={a.ticks}>
            {[
              t("تابع اشتراكك وتاريخ انتهائه", "Follow your subscription and its expiry"),
              t("جدّد بخطوتين وتابع طلبك", "Renew in two steps and track your order"),
              t("بيانات الدخول والإيصالات بمكان واحد", "Login details and receipts in one place"),
              t("تذاكر دعم مرتبطة باشتراكك", "Support tickets linked to your subscription"),
            ].map((item) => (
              <li key={item}>
                <span className={a.tick}>
                  <Check size={15} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <div className={a.card}>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
          <div className={a.form}>{children}</div>
          {footer ? <div className={a.foot}>{footer}</div> : null}
        </div>
      </div>
    </ToneShell>
  );
}
