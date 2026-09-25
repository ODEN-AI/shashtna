"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
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

function useNav(): NavGroup[] {
  const { t } = useLanguage();

  return [
    { label: t("الباقات", "Plans"), href: "/plans" },
    {
      label: t("شاهد على", "Watch on"),
      href: "/watch",
      items: [
        { href: "/watch/player", label: "Shashtna Player", description: t("المشغل الرسمي لشاشتنا", "The official Shashtna player") },
        { href: "/watch", label: t("الأجهزة المدعومة", "Supported devices"), description: t("اختار جهازك وشوف شنو تحتاج", "Pick your device and see what you need") },
        { href: "/apps", label: t("التطبيقات", "Apps"), description: t("روابط التحميل وطريقة الإعداد", "Downloads and setup guides") },
        { href: "/devices", label: t("أجهزة VIP", "VIP devices"), description: t("أجهزة جاهزة لتجربة VIP", "Ready-made devices for VIP") },
      ],
    },
    { label: t("خدماتنا", "Our services"), href: "/services" },
    { label: t("من نحن", "About us"), href: "/about" },
    {
      label: t("المساعدة", "Help"),
      href: "/help",
      items: [
        { href: "/help#faq", label: t("الأسئلة الشائعة", "FAQ"), description: t("أجوبة سريعة عن الاشتراك والدفع", "Quick answers on plans and payment") },
        { href: "/help/troubleshooting", label: t("حل المشاكل", "Troubleshooting"), description: t("خطوات لحل مشاكل التشغيل", "Fix playback and app issues") },
        { href: "/help/contact", label: t("تواصل ويانا", "Contact"), description: t("قنوات التواصل وساعات الدعم", "Channels and support hours") },
        { href: "/status", label: t("حالة الخدمة", "Service status"), description: t("أي أعطال أو صيانة معلنة", "Announced incidents and maintenance") },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  const path = href.split("#")[0];

  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

function DesktopMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const menuId = useId();
  const active = isActive(pathname, group.href) || group.items?.some((item) => isActive(pathname, item.href));

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
            "inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-semibold transition",
            active ? "text-ink" : "text-ink-2 hover:text-ink",
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
          "inline-flex h-10 items-center gap-1 rounded-xl px-3.5 text-sm font-semibold transition",
          active || open ? "text-ink" : "text-ink-2 hover:text-ink",
        )}
      >
        {group.label}
        <ChevronDown size={15} className={cn("transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          className="surface-raised animate-fade-up absolute start-0 top-12 z-50 w-80 rounded-2xl p-2"
        >
          <ul>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 transition hover:bg-surface-3"
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

export function SiteHeader({ user }: { user: HeaderUser }) {
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
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        // No backdrop-filter while the mobile menu is open: it would become the
        // containing block of the fixed menu panel and collapse it.
        mobileOpen
          ? "border-line bg-canvas"
          : scrolled
            ? "border-line bg-canvas/85 backdrop-blur-xl"
            : "border-transparent bg-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        {t("تخطَّ إلى المحتوى", "Skip to content")}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <nav aria-label={t("القائمة الرئيسية", "Main navigation")} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {nav.map((group) => (
                <DesktopMenu key={group.href} group={group} pathname={pathname} />
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle className="max-sm:hidden" />
          {user ? (
            <>
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
                {t("تسجيل الدخول", "Sign in")}
              </Link>
              <Link href="/plans" className={buttonClass("primary", "sm")}>
                {t("ابدأ الآن", "Get started")}
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 lg:hidden"
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
              <li>
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-12 items-center rounded-xl px-3 text-base font-bold text-ink hover:bg-surface-2"
                >
                  {t("الرئيسية", "Home")}
                </Link>
              </li>
              {nav.map((group) => (
                <li key={group.href}>
                  <Link
                    href={group.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex h-12 items-center rounded-xl px-3 text-base font-bold text-ink hover:bg-surface-2"
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
