"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  Tv2,
  UserRound,
  ChevronLeft,
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  CreditCard,
  Languages,
} from "lucide-react";

import {
  useLanguage,
  type Language,
} from "./LanguageProvider";

type UserData = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
};

export default function Navbar() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();

  const [user, setUser] = useState<UserData | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isArabic = language === "ar";

  function closeMobileMenu() {
    const menu =
      document.getElementById(
        "mobile-navbar-menu"
      ) as HTMLDetailsElement | null;

    if (menu) {
      menu.removeAttribute("open");
    }
  }

  useEffect(() => {
    setMounted(true);

    try {
      const savedUser =
        localStorage.getItem("user");

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      localStorage.removeItem("user");
      setUser(null);
    }

    const savedTheme =
      localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    } else {
      const prefersDark =
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;

      if (prefersDark) {
        document.documentElement.classList.add(
          "dark"
        );
        setDarkMode(true);
      }
    }
  }, []);

  function toggleDarkMode() {
    const nextMode = !darkMode;

    setDarkMode(nextMode);

    if (nextMode) {
      document.documentElement.classList.add(
        "dark"
      );
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove(
        "dark"
      );
      localStorage.setItem("theme", "light");
    }
  }

  function toggleLanguage() {
    const nextLanguage: Language =
      language === "ar" ? "en" : "ar";

    setLanguage(nextLanguage);
  }

  function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("remember");

    setUser(null);
    closeMobileMenu();

    window.location.href = "/";
  }

  const isAdmin =
    user?.role?.toUpperCase() === "ADMIN";

  function isActive(path: string) {
    if (path === "/") {
      return pathname === "/";
    }

    return (
      pathname === path ||
      pathname.startsWith(`${path}/`)
    );
  }

  const navItems = [
    {
      href: "/",
      label: isArabic ? "الرئيسية" : "Home",
    },
    {
      href: "/plans",
      label: isArabic ? "الباقات" : "Plans",
    },
    {
      href: "/apps",
      label: isArabic
        ? "التطبيقات"
        : "Apps",
    },
    {
      href: "/about",
      label: isArabic ? "من نحن" : "About",
    },
    {
      href: "/tickets",
      label: isArabic ? "الدعم" : "Support",
    },
  ];

  return (
    <header
      dir={isArabic ? "rtl" : "ltr"}
      className="sticky top-0 z-[100] border-b border-slate-200/60 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition-all duration-300 dark:border-slate-800/60 dark:bg-slate-950/80 dark:shadow-black/10"
    >
      <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        {/* Top glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent dark:via-cyan-400/30" />

        {/* =====================================================
            LOGO
            ===================================================== */}
        <Link
          href="/"
          onClick={closeMobileMenu}
          className="group flex items-center gap-3"
        >
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-blue-600/30">
            <div className="absolute -right-3 -top-3 h-7 w-7 rounded-full bg-white/20 blur-sm" />

            <div className="absolute -bottom-6 -left-5 h-10 w-10 rounded-full bg-cyan-300/10 blur-lg" />

            <Tv2
              size={23}
              strokeWidth={2.2}
              className="relative transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          <div className="leading-none">
            <div className="text-[19px] font-black tracking-tight text-slate-950 dark:text-white">
              شاشتنا
            </div>

            <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-blue-600 dark:text-cyan-400">
              ENTERTAINMENT
            </div>
          </div>
        </Link>

        {/* =====================================================
            DESKTOP NAVIGATION
            ===================================================== */}
        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => {
            const active =
              isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative py-2 text-sm transition-all duration-300 ${
                  active
                    ? "font-black text-blue-600 dark:text-blue-400"
                    : "font-semibold text-slate-600 hover:-translate-y-0.5 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                }`}
              >
                {item.label}

                <span
                  className={`absolute inset-x-0 -bottom-1 h-0.5 origin-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300 ${
                    active
                      ? "scale-x-100 opacity-100"
                      : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-70"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* =====================================================
            DESKTOP ACTIONS
            ===================================================== */}
        <div className="hidden items-center gap-2 md:flex">
          {mounted && (
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={
                isArabic
                  ? "Switch to English"
                  : "التبديل إلى العربية"
              }
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/60 px-3 text-xs font-black text-slate-600 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/80 hover:text-blue-600 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-cyan-400"
            >
              <Languages size={17} />

              <span>
                {isArabic ? "EN" : "العربية"}
              </span>
            </button>
          )}

          {mounted && (
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={
                darkMode
                  ? isArabic
                    ? "تفعيل الوضع الفاتح"
                    : "Switch to light mode"
                  : isArabic
                    ? "تفعيل الوضع الداكن"
                    : "Switch to dark mode"
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/60 text-slate-600 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/80 hover:text-blue-600 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-cyan-400"
            >
              {darkMode ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
          )}

          {user ? (
            <>
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  isArabic
                    ? "text-right"
                    : "text-left"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <UserRound size={17} />
                </div>

                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">
                    {user.name}
                  </div>

                  <div className="mt-0.5 text-[9px] font-bold tracking-wide text-slate-400">
                    {isAdmin
                      ? "ADMIN"
                      : "CUSTOMER"}
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 ${
                  isActive("/dashboard")
                    ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                    : "border-slate-200 bg-white/60 text-slate-700 backdrop-blur-xl hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                }`}
              >
                <LayoutDashboard size={17} />

                {isArabic
                  ? "لوحة التحكم"
                  : "Dashboard"}
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 ${
                    isActive("/admin")
                      ? "border-blue-300 bg-blue-100 text-blue-800 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300"
                      : "border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                  }`}
                >
                  <ShieldIcon />

                  {isArabic
                    ? "الإدارة"
                    : "Admin"}
                </Link>
              )}

              <Link
                href="/subscriptions"
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 ${
                  isActive("/subscriptions")
                    ? "bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                    : "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                }`}
              >
                {isArabic
                  ? "اشتراكاتي"
                  : "My Subscriptions"}

                <CreditCard size={16} />
              </Link>

              <button
                type="button"
                onClick={logout}
                aria-label={
                  isArabic
                    ? "تسجيل الخروج"
                    : "Sign out"
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 ${
                  isActive("/login")
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                <UserRound size={17} />

                {isArabic
                  ? "تسجيل الدخول"
                  : "Sign in"}
              </Link>

              <Link
                href="/plans"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-600/30"
              >
                {isArabic
                  ? "الباقات"
                  : "Plans"}

                <ChevronLeft
                  size={16}
                  className={
                    isArabic
                      ? ""
                      : "rotate-180"
                  }
                />
              </Link>
            </>
          )}
        </div>

        {/* =====================================================
            MOBILE ACTIONS
            ===================================================== */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={
              isArabic
                ? "Switch to English"
                : "التبديل إلى العربية"
            }
            className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3 text-xs font-black text-slate-600 shadow-sm backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300"
          >
            <Languages size={17} />

            {isArabic ? "EN" : "العربية"}
          </button>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300"
            aria-label={
              darkMode
                ? isArabic
                  ? "تفعيل الوضع الفاتح"
                  : "Switch to light mode"
                : isArabic
                  ? "تفعيل الوضع الداكن"
                  : "Switch to dark mode"
            }
          >
            {darkMode ? (
              <Sun size={19} />
            ) : (
              <Moon size={19} />
            )}
          </button>

          <details
            id="mobile-navbar-menu"
            className="group"
          >
            <summary
              aria-label={
                isArabic
                  ? "فتح القائمة"
                  : "Open menu"
              }
              className="relative z-[120] flex h-11 w-11 cursor-pointer list-none touch-manipulation select-none items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur-xl transition-all duration-200 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-200 [&::-webkit-details-marker]:hidden"
            >
              <Menu
                size={22}
                className="transition-transform duration-200 group-open:rotate-90"
              />
            </summary>

            <div className="absolute left-0 right-0 top-full z-[110] border-t border-slate-200/70 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:border-slate-800/70 dark:bg-slate-950 dark:shadow-black/30">
              <nav className="mx-auto max-h-[calc(100vh-80px)] max-w-7xl overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-1">
                  {navItems.map((item) => {
                    const active =
                      isActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={`rounded-2xl px-4 py-3.5 text-sm transition-all duration-200 ${
                          active
                            ? "bg-blue-50 font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                            : "font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                {user ? (
                  <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-4 dark:bg-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                          <UserRound size={18} />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-900 dark:text-white">
                            {user.name}
                          </div>

                          <div className="mt-1 text-xs font-bold text-slate-400">
                            {isAdmin
                              ? "ADMIN"
                              : "CUSTOMER"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Link
                      href="/dashboard"
                      onClick={closeMobileMenu}
                      className={`mb-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black ${
                        isActive(
                          "/dashboard"
                        )
                          ? "bg-blue-700 text-white"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      <LayoutDashboard
                        size={17}
                      />

                      {isArabic
                        ? "لوحة التحكم"
                        : "Dashboard"}
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={closeMobileMenu}
                        className={`mb-2 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black ${
                          isActive("/admin")
                            ? "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300"
                            : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                        }`}
                      >
                        <ShieldIcon />

                        {isArabic
                          ? "لوحة الإدارة"
                          : "Admin Panel"}
                      </Link>
                    )}

                    <Link
                      href="/subscriptions"
                      onClick={closeMobileMenu}
                      className={`mb-2 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold ${
                        isActive(
                          "/subscriptions"
                        )
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                          : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <CreditCard
                        size={17}
                      />

                      {isArabic
                        ? "اشتراكاتي"
                        : "My Subscriptions"}
                    </Link>

                    <button
                      type="button"
                      onClick={logout}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-bold text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                    >
                      <LogOut size={16} />

                      {isArabic
                        ? "تسجيل الخروج"
                        : "Sign out"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Link
                      href="/login"
                      onClick={closeMobileMenu}
                      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold ${
                        isActive("/login")
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                          : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <UserRound size={16} />

                      {isArabic
                        ? "الدخول"
                        : "Sign in"}
                    </Link>

                    <Link
                      href="/plans"
                      onClick={closeMobileMenu}
                      className="flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white"
                    >
                      {isArabic
                        ? "الباقات"
                        : "Plans"}
                    </Link>
                  </div>
                )}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function ShieldIcon() {
  return (
    <div className="flex h-[17px] w-[17px] items-center justify-center">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    </div>
  );
}