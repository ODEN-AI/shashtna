"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  CircleUserRound,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { buttonClass } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Logo } from "@/app/ui/Logo";

export type HeaderUser = { name: string; isStaff: boolean } | null;

type NavGroup = {
  label: string;
  href: string;
  items?: { href: string; label: string; description: string }[];
};

export async function signOut() {
  try {
    window.localStorage.removeItem("user");
    window.localStorage.removeItem("remember");
  } catch {
    // Storage can be unavailable (private mode); the cookie is what matters.
  }

  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/");
}

/**
 * Consumer navigation, shared with Shashtna Mobile's information
 * architecture. Digital Services is a separate business surface and lives
 * in the footer, not here. Paths are contracts (mobile deep links, Player
 * config) — labels may change, hrefs may not.
 */
function useNav(): NavGroup[] {
  const { t } = useLanguage();

  return [
    { label: t("الرئيسية", "Home"), href: "/" },
    { label: t("الباقات", "Plans"), href: "/plans" },
    {
      label: t("شاهد على", "Watch on"),
      href: "/watch",
      items: [
        { href: "/watch/player", label: "Shashtna Player", description: t("المشغل الرسمي لشاشتنا", "The official Shashtna player") },
        { href: "/apps", label: t("التطبيقات", "Apps"), description: t("روابط التحميل وطريقة الإعداد", "Downloads and setup guides") },
        { href: "/watch", label: t("الأجهزة المدعومة", "Supported devices"), description: t("اختار جهازك وشوف شنو تحتاج", "Pick your device and see what you need") },
        { href: "/devices", label: t("أجهزة VIP", "VIP devices"), description: t("أجهزة جاهزة لتجربة VIP", "Ready-made devices for VIP") },
      ],
    },
    { label: t("المشغّل", "Player"), href: "/watch/player" },
    { label: t("الأجهزة", "Devices"), href: "/devices" },
    {
      label: t("المساعدة", "Help"),
      href: "/help",
      items: [
        { href: "/help#faq", label: t("الأسئلة الشائعة", "FAQ"), description: t("أجوبة سريعة عن الاشتراك والدفع", "Quick answers on plans and payment") },
        { href: "/help/troubleshooting", label: t("حل المشاكل", "Troubleshooting"), description: t("خطوات لحل مشاكل التشغيل", "Fix playback and app issues") },
        { href: "/help/payment", label: t("الدفع", "Payment"), description: t("طريقة الدفع وإرسال الإثبات", "How to pay and send the proof") },
        { href: "/status", label: t("حالة الخدمة", "Service status"), description: t("أي أعطال أو صيانة معلنة", "Announced incidents and maintenance") },
        { href: "/help/contact", label: t("تواصل ويانا", "Contact"), description: t("قنوات التواصل وساعات الدعم", "Channels and support hours") },
      ],
    },
    { label: t("من نحن", "About"), href: "/about" },
  ];
}

function isActive(pathname: string, href: string) {
  const path = href.split("#")[0];

  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

function DesktopMenu({ group, pathname, topLevel }: { group: NavGroup; pathname: string; topLevel: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const menuId = useId();
  // A dropdown lights up for its own pages, but not for pages that also have
  // their own top-level item (Player, Devices), so one item is active at a time.
  const active = group.items
    ? group.items.some((item) => !topLevel.includes(item.href) && isActive(pathname, item.href))
    : isActive(pathname, group.href);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!group.items) {
    return (
      <li>
        <Link
          href={group.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative inline-flex h-10 items-center whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold transition xl:px-3",
            active ? "text-ink after:absolute after:inset-x-2.5 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-glow" : "text-ink-2 hover:bg-white/5 hover:text-ink",
          )}
        >
          {group.label}
        </Link>
      </li>
    );
  }

  return (
    <li ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold transition xl:px-3",
          active || open ? "text-ink" : "text-ink-2 hover:bg-white/5 hover:text-ink",
        )}
      >
        {group.label}
        <ChevronDown size={15} className={cn("transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          className="glass-strong animate-fade-up absolute start-0 top-12 z-50 w-80 rounded-2xl p-2"
        >
          <ul>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 transition hover:bg-white/8"
                >
                  <span className="block text-sm font-bold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">{item.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function LanguageToggle({ className }: { className?: string }) {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={cn(
        "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-line px-3 text-xs font-bold text-ink-2 transition hover:border-line-strong hover:text-ink",
        className,
      )}
      aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      {language === "ar" ? "EN" : "ع"}
    </button>
  );
}

function NotificationsBell({ unread }: { unread: number }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const label = unread
    ? t(`الإشعارات (${unread} غير مقروءة)`, `Notifications (${unread} unread)`)
    : t("الإشعارات", "Notifications");

  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={pathname === "/notifications" ? "page" : undefined}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 transition hover:border-line-strong hover:text-ink"
    >
      <Bell size={18} aria-hidden />
      {unread ? (
        <span className="nums absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-canvas">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export function SiteHeader({ user, unread = 0 }: { user: HeaderUser; unread?: number }) {
  const pathname = usePathname();
  const nav = useNav();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40">
      {/*
        Background layer. The glass (backdrop-filter) lives on this sibling,
        never on <header> itself: an element with backdrop-filter becomes the
        containing block of its position:fixed descendants, which would
        collapse the fixed mobile menu below.
      */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 transition-[background-color,opacity] duration-300",
          mobileOpen ? "border-b border-line bg-canvas" : scrolled ? "glass-bar" : "bg-transparent",
        )}
      />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        {t("تخطَّ إلى المحتوى", "Skip to content")}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 xl:gap-6">
          <Logo />
          <nav aria-label={t("القائمة الرئيسية", "Main navigation")} className="hidden lg:block">
            <ul className="flex items-center gap-0.5 xl:gap-1">
              {nav.map((group) => (
                <DesktopMenu
                  key={group.href}
                  group={group}
                  pathname={pathname}
                  topLevel={nav.filter((item) => !item.items).map((item) => item.href)}
                />
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle className="max-sm:hidden" />
          {user ? (
            <>
              <NotificationsBell unread={unread} />
              {user.isStaff ? (
                <Link href="/admin" className={buttonClass("ghost", "sm", "max-lg:hidden")}>
                  <ShieldCheck size={16} aria-hidden />
                  {t("الإدارة", "Admin")}
                </Link>
              ) : null}
              <Link href="/dashboard" className={buttonClass("primary", "sm", "max-sm:hidden")}>
                <LayoutDashboard size={16} aria-hidden />
                {t("حسابي", "My Shashtna")}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className={buttonClass("ghost", "sm", "max-lg:hidden")}
                aria-label={t("تسجيل الخروج", "Sign out")}
              >
                <LogOut size={16} aria-hidden />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm", "max-sm:hidden")}>
                {t("تسجيل الدخول", "Log in")}
              </Link>
              <Link href="/plans" className={buttonClass("primary", "sm")}>
                {t("ابدأ الآن", "Get started")}
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 transition hover:text-ink lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? t("إغلاق القائمة", "Close menu") : t("فتح القائمة", "Open menu")}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={19} aria-hidden /> : <Menu size={19} aria-hidden />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-line bg-canvas px-4 pb-10 pt-4 lg:hidden"
        >
          <nav aria-label={t("القائمة الرئيسية", "Main navigation")}>
            <ul className="space-y-1">
              {nav.map((group) => (
                <li key={group.href}>
                  <Link
                    href={group.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive(pathname, group.href) ? "page" : undefined}
                    className={cn(
                      "flex h-12 items-center rounded-xl px-3 text-base font-bold hover:bg-surface-2",
                      isActive(pathname, group.href) ? "bg-brand/15 text-ink" : "text-ink",
                    )}
                  >
                    {group.label}
                  </Link>
                  {group.items ? (
                    <ul className="mb-2 ms-3 border-s border-line ps-3">
                      {group.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-6 space-y-2 border-t border-line pt-6">
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className={buttonClass("primary", "lg", "w-full")}>
                  <LayoutDashboard size={18} aria-hidden />
                  {t("حسابي", "My Shashtna")}
                </Link>
                {user.isStaff ? (
                  <Link href="/admin" onClick={() => setMobileOpen(false)} className={buttonClass("secondary", "lg", "w-full")}>
                    <ShieldCheck size={18} aria-hidden />
                    {t("لوحة الإدارة", "Admin console")}
                  </Link>
                ) : null}
                <button type="button" onClick={signOut} className={buttonClass("ghost", "lg", "w-full")}>
                  <LogOut size={18} aria-hidden />
                  {t("تسجيل الخروج", "Sign out")}
                </button>
              </>
            ) : (
              <>
                <Link href="/register" onClick={() => setMobileOpen(false)} className={buttonClass("primary", "lg", "w-full")}>
                  <CircleUserRound size={18} aria-hidden />
                  {t("إنشاء حساب", "Create account")}
                </Link>
                <Link href="/login" onClick={() => setMobileOpen(false)} className={buttonClass("secondary", "lg", "w-full")}>
                  {t("تسجيل الدخول", "Sign in")}
                </Link>
              </>
            )}
            <Link href="/help/contact" onClick={() => setMobileOpen(false)} className={buttonClass("ghost", "lg", "w-full")}>
              <Headphones size={18} aria-hidden />
              {t("الدعم الفني", "Support")}
            </Link>
            <LanguageToggle className="w-full" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
