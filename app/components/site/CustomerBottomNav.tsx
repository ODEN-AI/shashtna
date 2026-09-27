"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppWindow, CircleUserRound, Headphones, House, Tv } from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { cn } from "@/app/ui/cn";

/**
 * Bottom navigation for signed-in customers on phones: a floating glass bar
 * in the style of Shashtna Mobile. Five tabs only — Orders are reached from
 * Home and Notifications from the header bell.
 */
export function CustomerBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/dashboard", label: t("الرئيسية", "Home"), icon: House, match: ["/dashboard", "/orders", "/receipts", "/notifications"] },
    { href: "/subscriptions", label: t("اشتراكي", "Subscription"), icon: Tv, match: ["/subscriptions"] },
    { href: "/account/devices", label: t("الأجهزة", "Devices"), icon: AppWindow, match: ["/account/devices"] },
    { href: "/support", label: t("الدعم", "Support"), icon: Headphones, match: ["/support"] },
    { href: "/account", label: t("الحساب", "Account"), icon: CircleUserRound, match: ["/account"] },
  ];

  // Checkout has its own sticky action bar.
  if (pathname.startsWith("/checkout")) {
    return null;
  }

  const activeHref =
    items
      .flatMap((item) => item.match.map((prefix) => ({ prefix, href: item.href })))
      .filter(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
      .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.href ?? null;

  return (
    <nav
      aria-label={t("تنقل الحساب", "Account navigation")}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.625rem)] z-40 mx-auto max-w-md rounded-[1.4rem] glass-strong lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = activeHref === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition",
                  active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition",
                    active && "bg-brand/25 text-glow",
                  )}
                >
                  <Icon size={20} aria-hidden />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
