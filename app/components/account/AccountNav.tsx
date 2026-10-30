"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppWindow,
  Bell,
  CircleUserRound,
  Gift,
  Headphones,
  House,
  LogOut,
  ReceiptText,
  Tv,
} from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { signOut } from "@/app/components/site/SiteHeader";

import a from "./account.module.css";

export function AccountNav({ unread, name, points = false }: { unread: number; name: string; points?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    // Same order as Shashtna Mobile's "My Shashtna".
    { href: "/dashboard", label: t("الرئيسية", "Home"), icon: House },
    { href: "/subscriptions", label: t("اشتراكي", "Subscription"), icon: Tv },
    { href: "/orders", label: t("الطلبات", "Orders"), icon: ReceiptText, also: ["/receipts"] },
    ...(points ? [{ href: "/points", label: t("نقاط شاشتنا", "Shashtna Points"), icon: Gift }] : []),
    { href: "/notifications", label: t("الإشعارات", "Notifications"), icon: Bell, badge: unread },
    { href: "/account/devices", label: t("الأجهزة والتطبيقات", "Devices & apps"), icon: AppWindow },
    { href: "/support", label: t("الدعم الفني", "Support"), icon: Headphones },
    { href: "/account", label: t("الحساب", "Account"), icon: CircleUserRound, exact: true },
  ];

  const isActive = (item: (typeof items)[number]) =>
    item.exact
      ? pathname === item.href
      : [item.href, ...(item.also ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label={t("قائمة الحساب", "Account menu")} className={a.nav}>
      <div className={a.who}>
        <span className={a.avatar} aria-hidden>
          {Array.from(name.trim())[0] ?? "?"}
        </span>
        <span className="min-w-0">
          <small>{t("حسابي", "My Shashtna")}</small>
          <b>{name}</b>
        </span>
      </div>
      <ul className={a.navList}>
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive(item) ? "page" : undefined} className={a.navLink}>
                <Icon size={19} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge ? <span className={`${a.count} nums`}>{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={a.signOut}>
        <button type="button" onClick={signOut} className={a.navLink}>
          <LogOut size={19} aria-hidden />
          {t("تسجيل الخروج", "Sign out")}
        </button>
      </div>
    </nav>
  );
}
