"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLanguage } from "@/app/components/LanguageProvider";

import a from "./account.module.css";

/** Section switcher for the account area on phones (the sidebar is desktop-only). */
export function AccountMobileTabs({ unread }: { unread: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/dashboard", label: t("الرئيسية", "Home") },
    { href: "/subscriptions", label: t("اشتراكي", "Subscription") },
    { href: "/orders", label: t("الطلبات", "Orders"), also: "/receipts" },
    { href: "/notifications", label: t("الإشعارات", "Notifications"), badge: unread },
    { href: "/account/devices", label: t("الأجهزة والتطبيقات", "Devices & apps") },
    { href: "/support", label: t("الدعم", "Support") },
    { href: "/account", label: t("الحساب", "Account"), exact: true },
  ];

  return (
    <nav aria-label={t("أقسام الحساب", "Account sections")} className={a.tabs}>
      <ul>
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : [item.href, item.also].filter(Boolean).some((href) => pathname === href || pathname.startsWith(`${href}/`));

          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={a.tab}>
                {item.label}
                {item.badge ? <span className={`${a.count} nums`}>{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
