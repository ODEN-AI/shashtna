"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  CircleUserRound,
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
 *
 * Each destination appears once: the logo is the way home, the player sits
 * under "Watch on", and VIP devices is its own item.
 */
function useNav(): NavGroup[] {
  const { t } = useLanguage();

  return [
    { label: t("الباقات", "Plans"), href: "/plans" },
    {
      label: t("شاهد على", "Watch on"),
      href: "/watch",
      items: [
        { href: "/watch/player", label: "Shashtna Player", description: t("المشغل الرسمي لشاشتنا", "The official Shashtna player") },
        { href: "/apps", label: t("التطبيقات", "Apps"), description: t("روابط التحميل وطريقة الإعداد", "Downloads and setup guides") },
        { href: "/watch", label: t("الأجهزة المدعومة", "Supported devices"), description: t("اختار جهازك وشوف شنو تحتاج", "Pick your device and see what you need") },
      ],
    },
    { label: t("أجهزة VIP", "VIP devices"), href: "/devices" },
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

/**
 * One open desktop dropdown at a time (the nav menus and the account menu
 * share it). Escape closes it and returns focus to its button; a click or
 * focus outside closes it; so does moving to another page.
 */
function useDropdown<T extends HTMLElement>(name: string, openMenu: string | null, setOpenMenu: (name: string | null) => void) {
  const open = openMenu === name;
  const ref = useRef<T>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        buttonRef.current?.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);

    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open, setOpenMenu]);

  const button = {
    ref: buttonRef,
    type: "button" as const,
    "aria-expanded": open,
    "aria-controls": menuId,
    onClick: () => setOpenMenu(open ? null : name),
  };

  return { open, ref, menuId, button, close: () => setOpenMenu(null) };
}

const dropdownPanel = "glass-strong animate-fade-up absolute top-12 z-50 rounded-2xl p-2";

function DesktopMenu({
  group,
  pathname,
  openMenu,
  setOpenMenu,
}: {
  group: NavGroup;
  pathname: string;
  openMenu: string | null;
  setOpenMenu: (name: string | null) => void;
}) {
  const { open, ref, menuId, button, close } = useDropdown<HTMLLIElement>(group.href, openMenu, setOpenMenu);
  const active = group.items ? group.items.some((item) => isActive(pathname, item.href)) : isActive(pathname, group.href);

  if (!group.items) {
    return (
      <li>
        <Link
          href={group.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative inline-flex h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition",
            active ? "text-ink after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-glow" : "text-ink-2 hover:bg-white/5 hover:text-ink",
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
        {...button}
        className={cn(
          "relative inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition",
          active || open ? "text-ink" : "text-ink-2 hover:bg-white/5 hover:text-ink",
          active && "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-glow",
        )}
      >
        {group.label}
        <ChevronDown size={15} className={cn("transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={menuId} className={cn(dropdownPanel, "start-0 w-80")}>
          <ul>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={isActive(pathname, item.href) && !item.href.includes("#") ? "page" : undefined}
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

/** Signed-in customers: My Shashtna, the admin console (staff only) and sign out, in one menu. */
function AccountMenu({
  user,
  openMenu,
  setOpenMenu,
}: {
  user: NonNullable<HeaderUser>;
  openMenu: string | null;
  setOpenMenu: (name: string | null) => void;
}) {
  const { t } = useLanguage();
  const { open, ref, menuId, button, close } = useDropdown<HTMLDivElement>("account", openMenu, setOpenMenu);
  const item = "flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition";

  return (
    <div ref={ref} className="relative max-sm:hidden">
      <button {...button} className={buttonClass("primary", "md", "px-4")}>
        <LayoutDashboard size={16} aria-hidden />
        {t("حسابي", "My Shashtna")}
        <ChevronDown size={15} className={cn("transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={menuId} className={cn(dropdownPanel, "end-0 w-60")}>
          <p className="truncate px-3 pb-2 pt-1 text-xs text-ink-3">{user.name}</p>
          <ul>
            <li>
              <Link href="/dashboard" onClick={close} className={cn(item, "text-ink hover:bg-white/8")}>
                <LayoutDashboard size={16} aria-hidden />
                {t("حسابي", "My Shashtna")}
              </Link>
            </li>
            {user.isStaff ? (
              <li>
                <Link href="/admin" onClick={close} className={cn(item, "text-ink hover:bg-white/8")}>
                  <ShieldCheck size={16} aria-hidden />
                  {t("لوحة الإدارة", "Admin console")}
                </Link>
              </li>
            ) : null}
            <li className="mt-1 border-t border-line pt-1">
              <button type="button" onClick={signOut} className={cn(item, "text-ink-2 hover:bg-white/8 hover:text-danger")}>
                <LogOut size={16} aria-hidden />
                {t("تسجيل الخروج", "Sign out")}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LanguageToggle({ className }: { className?: string }) {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-line px-3 text-xs font-bold text-ink-2 transition hover:border-line-strong hover:text-ink",
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
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition hover:border-line-strong hover:text-ink"
    >
      <Bell size={18} aria-hidden />
      {unread ? (
        <span className="nums absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white ring-2 ring-canvas">
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // A new page closes whatever menu was open.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpenMenu(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // While the phone menu is open the page underneath does not scroll, and the
  // customer bottom bar (which reads data-menu-open) steps aside.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    if (mobileOpen) {
      document.body.dataset.menuOpen = "true";
    } else {
      delete document.body.dataset.menuOpen;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      document.addEventListener("keydown", onKey);
    }

    return () => {
      document.body.style.overflow = "";
      delete document.body.dataset.menuOpen;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);
  const mobileLink = (active: boolean) =>
    cn(
      "flex h-12 items-center rounded-xl px-3 text-base font-bold hover:bg-surface-2",
      active ? "bg-brand/15 text-ink" : "text-ink",
    );

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
          <Logo plain />
          <nav aria-label={t("القائمة الرئيسية", "Main navigation")} className="hidden lg:block">
            <ul className="flex items-center gap-0.5 xl:gap-1">
              {nav.map((group) => (
                <DesktopMenu key={group.href} group={group} pathname={pathname} openMenu={openMenu} setOpenMenu={setOpenMenu} />
              ))}
            </ul>
          </nav>
        </div>

        {/* Language, then the account actions, kept apart from the navigation. */}
        <div className="flex items-center gap-2">
          <LanguageToggle className="max-sm:hidden" />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />
          {user ? (
            <>
              <NotificationsBell unread={unread} />
              <AccountMenu user={user} openMenu={openMenu} setOpenMenu={setOpenMenu} />
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "md", "px-4 max-sm:hidden")}>
                {t("تسجيل الدخول", "Log in")}
              </Link>
              <Link href="/plans" className={buttonClass("primary", "md", "px-4")}>
                {t("ابدأ الآن", "Get started")}
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition hover:text-ink lg:hidden"
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
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-line bg-canvas px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-4 lg:hidden"
        >
          <nav aria-label={t("القائمة الرئيسية", "Main navigation")}>
            <ul className="space-y-1">
              {nav.map((group) =>
                group.items ? (
                  <li key={group.href} className="pt-2">
                    {/* Help keeps its own page; Watch on's page is "Supported devices" below. */}
                    {group.items.some((item) => item.href === group.href) ? (
                      <p className="flex h-10 items-center px-3 text-sm font-bold text-ink-3">{group.label}</p>
                    ) : (
                      <Link
                        href={group.href}
                        onClick={closeMobile}
                        aria-current={pathname === group.href ? "page" : undefined}
                        className={mobileLink(pathname === group.href)}
                      >
                        {group.label}
                      </Link>
                    )}
                    <ul className="mb-2 ms-3 border-s border-line ps-3">
                      {group.items.map((item) => {
                        const active = isActive(pathname, item.href) && !item.href.includes("#");

                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={closeMobile}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-surface-2 hover:text-ink",
                                active ? "bg-brand/15 text-ink" : "text-ink-2",
                              )}
                            >
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ) : (
                  <li key={group.href}>
                    <Link
                      href={group.href}
                      onClick={closeMobile}
                      aria-current={isActive(pathname, group.href) ? "page" : undefined}
                      className={mobileLink(isActive(pathname, group.href))}
                    >
                      {group.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="mt-6 space-y-2 border-t border-line pt-6">
            {user ? (
              <>
                <Link href="/dashboard" onClick={closeMobile} className={buttonClass("primary", "lg", "w-full")}>
                  <LayoutDashboard size={18} aria-hidden />
                  {t("حسابي", "My Shashtna")}
                </Link>
                {user.isStaff ? (
                  <Link href="/admin" onClick={closeMobile} className={buttonClass("secondary", "lg", "w-full")}>
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
                <Link href="/login" onClick={closeMobile} className={buttonClass("secondary", "lg", "w-full")}>
                  {t("تسجيل الدخول", "Sign in")}
                </Link>
                <Link href="/register" onClick={closeMobile} className={buttonClass("ghost", "lg", "w-full")}>
                  <CircleUserRound size={18} aria-hidden />
                  {t("إنشاء حساب", "Create account")}
                </Link>
              </>
            )}
            <LanguageToggle className="w-full" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
