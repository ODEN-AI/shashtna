"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Tv,
  CreditCard,
  Smartphone,
  Headphones,
  LogOut,
  ChevronLeft,
  CircleUserRound,
  ReceiptText,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

type UserData = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
};

export default function DashboardPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  const [user, setUser] =
    useState<UserData | null>(null);

  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const storedUser =
        localStorage.getItem("user");

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      localStorage.removeItem("user");
      setUser(null);
    }
  }, []);

  function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("remember");

    window.location.href = "/";
  }

  const userName =
    user?.name ||
    (isArabic ? "Ø¹Ù…ÙŠÙ„Ù†Ø§" : "Customer");

  const isAdmin =
    user?.role?.toUpperCase() === "ADMIN";

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white"
    >
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-8">
          <p className="mb-2 text-sm font-bold text-blue-600 dark:text-blue-400">
            {isArabic
              ? "Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…"
              : "Dashboard"}
          </p>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {isArabic
              ? `Ø£Ù‡Ù„Ø§Ù‹ ${userName} ðŸ‘‹`
              : `Welcome ${userName} ðŸ‘‹`}
          </h1>

          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {isArabic
              ? "Ù…Ù† Ù‡Ù†Ø§ ØªÙ‚Ø¯Ø± ØªØ¯ÙŠØ± Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙƒ ÙˆØ£Ø¬Ù‡Ø²ØªÙƒ ÙˆØ·Ù„Ø¨Ø§ØªÙƒ ÙˆØ¥ÙŠØµØ§Ù„Ø§ØªÙƒ ÙˆØªØ¬Ø¯ÙŠØ¯Ø§ØªÙƒ."
              : "From here you can manage your subscriptions, devices, orders, receipts, and renewals."}
          </p>
        </div>

        {!mounted ? (
          <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                icon={<Tv size={22} />}
                title={
                  isArabic
                    ? "Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ"
                    : "Current subscription"
                }
                value={
                  isArabic
                    ? "Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø§Ø´ØªØ±Ø§Ùƒ"
                    : "No subscription"
                }
                iconClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              />

              <DashboardCard
                icon={<Smartphone size={22} />}
                title={
                  isArabic
                    ? "Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ù…ØªØµÙ„Ø©"
                    : "Connected devices"
                }
                value={
                  isArabic
                    ? "0 Ø¬Ù‡Ø§Ø²"
                    : "0 devices"
                }
                iconClass="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
              />

              <DashboardCard
                icon={<CreditCard size={22} />}
                title={
                  isArabic
                    ? "Ø§Ù„Ø·Ù„Ø¨Ø§Øª"
                    : "Orders"
                }
                value={
                  isArabic
                    ? "0 Ø·Ù„Ø¨"
                    : "0 orders"
                }
                iconClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              />

              <DashboardCard
                icon={<Headphones size={22} />}
                title={
                  isArabic
                    ? "Ø§Ù„Ø¯Ø¹Ù…"
                    : "Support"
                }
                value={
                  isArabic
                    ? "Ù…ÙØªÙˆØ­ 24/7"
                    : "Daily, 10 AM – 11 PM"
                }
                iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
              />
            </div>

            <div className="mb-8 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              <DashboardLink
                href="/plans"
                title={
                  isArabic
                    ? "Ø§Ù„Ø¨Ø§Ù‚Ø§Øª"
                    : "Plans"
                }
                description={
                  isArabic
                    ? "ØªØµÙØ­ Ø§Ù„Ø¨Ø§Ù‚Ø§Øª Ø§Ù„Ù…ØªÙˆÙØ±Ø© ÙˆØ§Ø®ØªØ± Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ø§Ù„Ù…Ù†Ø§Ø³Ø¨."
                    : "Browse available plans and choose the right subscription."
                }
              />

              <DashboardLink
                href="/subscriptions"
                title={
                  isArabic
                    ? "Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙŠ"
                    : "My subscriptions"
                }
                description={
                  isArabic
                    ? "ØªØ§Ø¨Ø¹ Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙƒ ÙˆØªÙØ§ØµÙŠÙ„Ù‡Ø§ ÙˆØªÙˆØ§Ø±ÙŠØ® Ø§Ù†ØªÙ‡Ø§Ø¦Ù‡Ø§."
                    : "Track your subscriptions, details, and expiry dates."
                }
              />

              <DashboardLink
                href="/receipts"
                title={
                  isArabic
                    ? "Ø¥ÙŠØµØ§Ù„Ø§ØªÙŠ"
                    : "My receipts"
                }
                description={
                  isArabic
                    ? "Ø´ÙˆÙ Ø¥ÙŠØµØ§Ù„Ø§Øª Ø´Ø±Ø§Ø¡ Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙƒ ÙˆØªÙØ§ØµÙŠÙ„ ÙƒÙ„ Ø¹Ù…Ù„ÙŠØ©."
                    : "View your subscription receipts and purchase details."
                }
              />

              <DashboardLink
                href="/devices"
                title={
                  isArabic
                    ? "Ø£Ø¬Ù‡Ø²ØªÙŠ"
                    : "My devices"
                }
                description={
                  isArabic
                    ? "ØªØ§Ø¨Ø¹ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙƒ."
                    : "Track the devices connected to your subscriptions."
                }
              />

              <DashboardLink
                href="/tickets"
                title={
                  isArabic
                    ? "Ø§Ù„Ø¯Ø¹Ù… Ø§Ù„ÙÙ†ÙŠ"
                    : "Technical support"
                }
                description={
                  isArabic
                    ? "ØªÙˆØ§ØµÙ„ Ù…Ø¹ ÙØ±ÙŠÙ‚ Ø§Ù„Ø¯Ø¹Ù… Ø¹Ù†Ø¯ Ø§Ù„Ø­Ø§Ø¬Ø©."
                    : "Contact our support team whenever you need help."
                }
              />
            </div>

            {isAdmin && (
              <div className="rounded-3xl border border-blue-100 bg-gradient-to-l from-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-600/20 dark:border-blue-500/20">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs font-bold text-blue-100">
                      {isArabic
                        ? "ØµÙ„Ø§Ø­ÙŠØ§Øª Ø§Ù„Ù…Ø¯ÙŠØ±"
                        : "Administrator access"}
                    </div>

                    <h2 className="mt-2 text-2xl font-black">
                      {isArabic
                        ? "Ø£Ù†Øª Ù…Ø³Ø¬Ù„ ÙƒÙ…Ø¯ÙŠØ± Ù„Ù„Ù†Ø¸Ø§Ù…"
                        : "You are signed in as an administrator"}
                    </h2>

                    <p className="mt-2 max-w-xl text-sm leading-7 text-blue-100">
                      {isArabic
                        ? "ØªÙ‚Ø¯Ø± Ù…Ù† Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆØ§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª ÙˆØ§Ù„Ø¨Ø§Ù‚Ø§Øª ÙˆØ§Ù„Ø·Ù„Ø¨Ø§Øª ÙˆØ¨Ø§Ù‚ÙŠ Ø£Ù‚Ø³Ø§Ù… Ø§Ù„Ù†Ø¸Ø§Ù…."
                        : "From the admin panel, you can manage customers, subscriptions, plans, orders, and the rest of the system."}
                    </p>
                  </div>

                  <Link
                    href="/admin"
                    className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-50"
                  >
                    {isArabic
                      ? "Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¥Ù„Ù‰ Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©"
                      : "Open admin panel"}

                    <ChevronLeft
                      size={18}
                      className={
                        isArabic
                          ? ""
                          : "rotate-180"
                      }
                    />
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {user && (
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <CircleUserRound size={19} />
                  </div>

                  <div>
                    <div className="text-sm font-black">
                      {user.name}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      {user.email}
                    </div>
                  </div>

                  <div
                    className={`mr-auto ml-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${
                      isArabic
                        ? ""
                        : "ml-auto mr-0"
                    }`}
                  >
                    {isAdmin
                      ? "ADMIN"
                      : "CUSTOMER"}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                <LogOut size={17} />

                {isArabic
                  ? "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬"
                  : "Sign out"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function DashboardCard({
  icon,
  title,
  value,
  iconClass,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
      >
        {icon}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <p className="mt-1 text-xl font-black">
        {value}
      </p>
    </div>
  );
}

function DashboardLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <ChevronLeft
          size={22}
          className="shrink-0 text-slate-300 transition group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400"
        />
      </div>
    </Link>
  );
}
