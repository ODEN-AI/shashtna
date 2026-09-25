"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppWindow,
  Bell,
  CircleUserRound,
  Headphones,
  House,
  LogOut,
  ReceiptText,
  Tv,
} from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { signOut } from "@/app/components/site/SiteHeader";
import { cn } from "@/app/ui/cn";

export function AccountNav({ unread, name }: { unread: number; name: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/dashboard", label: t("نظرة عامة", "Overview"), icon: House },
    { href: "/subscriptions", label: t("اشتراكاتي", "Subscriptions"), icon: Tv },
    { href: "/orders", label: t("الطلبات والإيصالات", "Orders & receipts"), icon: ReceiptText, also: ["/receipts"] },
    { href: "/account/devices", label: t("الأجهزة والتطبيقات", "Devices & apps"), icon: AppWindow },
    { href: "/support", label: t("الدعم الفني", "Support"), icon: Headphones },
    { href: "/notifications", label: t("الإشعارات", "Notifications"), icon: Bell, badge: unread },
    { href: "/account", label: t("الحساب", "Account"), icon: CircleUserRound, exact: true },
  ];

  const isActive = (item: (typeof items)[number]) =>
    item.exact
      ? pathname === item.href
      : [item.href, ...(item.also ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label={t("قائمة الحساب", "Account menu")} className="surface sticky top-24 rounded-panel p-3">
      <div className="border-b border-line px-3 pb-4 pt-2">
        <p className="text-xs text-ink-3">{t("حسابي", "My Shashtna")}</p>
        <p className="mt-1 truncate font-bold text-ink">{name}</p>
      </div>
      <ul className="mt-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                  active ? "bg-brand/15 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon size={18} className={active ? "text-brand-ink" : "text-ink-3"} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="nums rounded-full bg-glow/15 px-2 py-0.5 text-xs font-bold text-glow">{item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={signOut}
        className="mt-2 flex h-11 w-full items-center gap-3 rounded-xl border-t border-line px-3 pt-2 text-sm font-semibold text-ink-3 transition hover:text-danger"
      >
        <LogOut size={18} aria-hidden />
        {t("تسجيل الخروج", "Sign out")}
      </button>
    </nav>
  );
}
