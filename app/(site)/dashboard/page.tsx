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
    (isArabic ? "عميلنا" : "Customer");

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
              ? "لوحة التحكم"
              : "Dashboard"}
          </p>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {isArabic
              ? `أهلاً ${userName} 👋`
              : `Welcome ${userName} 👋`}
          </h1>

          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {isArabic
              ? "من هنا تقدر تدير اشتراكاتك وأجهزتك وطلباتك وإيصالاتك وتجديداتك."
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
                    ? "الاشتراك الحالي"
                    : "Current subscription"
                }
                value={
                  isArabic
                    ? "لا يوجد اشتراك"
                    : "No subscription"
                }
                iconClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              />

              <DashboardCard
                icon={<Smartphone size={22} />}
                title={
                  isArabic
                    ? "الأجهزة المتصلة"
                    : "Connected devices"
                }
                value={
                  isArabic
                    ? "0 جهاز"
                    : "0 devices"
                }
                iconClass="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
              />

              <DashboardCard
                icon={<CreditCard size={22} />}
                title={
                  isArabic
                    ? "الطلبات"
                    : "Orders"
                }
                value={
                  isArabic
                    ? "0 طلب"
                    : "0 orders"
                }
                iconClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              />

              <DashboardCard
                icon={<Headphones size={22} />}
                title={
                  isArabic
                    ? "الدعم"
                    : "Support"
                }
                value={
                  isArabic
                    ? "مفتوح 24/7"
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
                    ? "الباقات"
                    : "Plans"
                }
                description={
                  isArabic
                    ? "تصفح الباقات المتوفرة واختر الاشتراك المناسب."
                    : "Browse available plans and choose the right subscription."
                }
              />

              <DashboardLink
                href="/subscriptions"
                title={
                  isArabic
                    ? "اشتراكاتي"
                    : "My subscriptions"
                }
                description={
                  isArabic
                    ? "تابع اشتراكاتك وتفاصيلها وتواريخ انتهائها."
                    : "Track your subscriptions, details, and expiry dates."
                }
              />

              <DashboardLink
                href="/receipts"
                title={
                  isArabic
                    ? "إيصالاتي"
                    : "My receipts"
                }
                description={
                  isArabic
                    ? "شوف إيصالات شراء اشتراكاتك وتفاصيل كل عملية."
                    : "View your subscription receipts and purchase details."
                }
              />

              <DashboardLink
                href="/devices"
                title={
                  isArabic
                    ? "أجهزتي"
                    : "My devices"
                }
                description={
                  isArabic
                    ? "تابع الأجهزة المرتبطة باشتراكاتك."
                    : "Track the devices connected to your subscriptions."
                }
              />

              <DashboardLink
                href="/tickets"
                title={
                  isArabic
                    ? "الدعم الفني"
                    : "Technical support"
                }
                description={
                  isArabic
                    ? "تواصل مع فريق الدعم عند الحاجة."
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
                        ? "صلاحيات المدير"
                        : "Administrator access"}
                    </div>

                    <h2 className="mt-2 text-2xl font-black">
                      {isArabic
                        ? "أنت مسجل كمدير للنظام"
                        : "You are signed in as an administrator"}
                    </h2>

                    <p className="mt-2 max-w-xl text-sm leading-7 text-blue-100">
                      {isArabic
                        ? "تقدر من لوحة الإدارة إدارة العملاء والاشتراكات والباقات والطلبات وباقي أقسام النظام."
                        : "From the admin panel, you can manage customers, subscriptions, plans, orders, and the rest of the system."}
                    </p>
                  </div>

                  <Link
                    href="/admin"
                    className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-blue-700 transition hover:bg-blue-50"
                  >
                    {isArabic
                      ? "الدخول إلى لوحة الإدارة"
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
                  ? "تسجيل الخروج"
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
