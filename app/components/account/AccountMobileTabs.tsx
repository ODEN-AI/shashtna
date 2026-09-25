"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLanguage } from "@/app/components/LanguageProvider";
import { cn } from "@/app/ui/cn";

/** Section switcher for the account area on phones (the sidebar is desktop-only). */
export function AccountMobileTabs({ unread }: { unread: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/dashboard", label: t("نظرة عامة", "Overview") },
    { href: "/subscriptions", label: t("اشتراكاتي", "Subscriptions") },
    { href: "/orders", label: t("الطلبات", "Orders"), also: "/receipts" },
    { href: "/account/devices", label: t("الأجهزة", "Devices") },
    { href: "/support", label: t("الدعم", "Support") },
    { href: "/notifications", label: t("الإشعارات", "Notifications"), badge: unread },
    { href: "/account", label: t("الحساب", "Account"), exact: true },
  ];

  return (
    <nav aria-label={t("أقسام الحساب", "Account sections")} className="scrollbar-none -mx-4 mb-5 overflow-x-auto px-4 lg:hidden">
      <ul className="flex w-max gap-2">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : [item.href, item.also].filter(Boolean).some((href) => pathname === href || pathname.startsWith(`${href}/`));

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition",
                  active ? "border-brand/60 bg-brand/15 text-ink" : "border-line bg-surface text-ink-3",
                )}
              >
                {item.label}
                {item.badge ? <span className="nums rounded-full bg-glow/20 px-1.5 text-glow">{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
