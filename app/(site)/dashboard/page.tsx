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
  Settings,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

type UserData = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  role: string;
};

type SubscriptionData = {
  id: number;
  serviceType: string;
  username: string | null;
  password: string | null;
  macAddress: string | null;
  deviceId: string | null;
  status: string;
  packageName: string;
  startDate: string;
  expiryDate: string;
  connections: number;
  maxConnections: number;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  const [user, setUser] =
    useState<UserData | null>(null);

  const [mounted, setMounted] =
    useState(false);

  const [currentSubscription, setCurrentSubscription] =
    useState<SubscriptionData | null>(null);

  const [subscriptionLoading, setSubscriptionLoading] =
    useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const storedUser =
        localStorage.getItem("user");

      if (storedUser) {
        const parsedUser =
          JSON.parse(storedUser) as UserData;

        setUser(parsedUser);
      }
    } catch {
      localStorage.removeItem("user");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const currentUserId = user?.id;

    if (
      !currentUserId ||
      !Number.isInteger(currentUserId) ||
      currentUserId <= 0
    ) {
      setCurrentSubscription(null);
      return;
    }

    let cancelled = false;

    async function loadCurrentSubscription() {
      try {
        setSubscriptionLoading(true);

        const response = await fetch(
          `/api/subscriptions?userId=${encodeURIComponent(
            String(currentUserId)
          )}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.subscriptions)
        ) {
          if (!cancelled) {
            setCurrentSubscription(null);
          }

          return;
        }

        const now = Date.now();

        const activeSubscriptions =
          data.subscriptions.filter(
            (subscription: SubscriptionData) => {
              const status =
                subscription.status?.toUpperCase();

              const expiryTime =
                new Date(
                  subscription.expiryDate
                ).getTime();

              return (
                status === "ACTIVE" &&
                Number.isFinite(expiryTime) &&
                expiryTime >= now
              );
            }
          );

        activeSubscriptions.sort(
          (
            a: SubscriptionData,
            b: SubscriptionData
          ) =>
            new Date(
              b.expiryDate
            ).getTime() -
            new Date(
              a.expiryDate
            ).getTime()
        );

        if (!cancelled) {
          setCurrentSubscription(
            activeSubscriptions[0] ?? null
          );
        }
      } catch (error) {
        console.error(
          "Dashboard subscription error:",
          error
        );

        if (!cancelled) {
          setCurrentSubscription(null);
        }
      } finally {
        if (!cancelled) {
          setSubscriptionLoading(false);
        }
      }
    }

    loadCurrentSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("remember");

    window.location.href = "/";
  }

  function formatExpiryDate(
    expiryDate: string
  ) {
    const date =
      new Date(expiryDate);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return new Intl.DateTimeFormat(
      isArabic
        ? "ar-IQ"
        : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    ).format(date);
  }

  const userName =
    user?.name ||
    (isArabic
      ? "عميلنا"
      : "Customer");

  const isAdmin =
    user?.role?.toUpperCase() ===
    "ADMIN";

  let subscriptionValue =
    isArabic
      ? "لا يوجد اشتراك"
      : "No subscription";

  let subscriptionSecondary =
    "";

  if (subscriptionLoading) {
    subscriptionValue =
      isArabic
        ? "جاري التحميل..."
        : "Loading...";
  } else if (
    currentSubscription
  ) {
    subscriptionValue =
      currentSubscription.packageName ||
      (isArabic
        ? "اشتراك IPTV"
        : "IPTV Subscription");

    const expiry =
      formatExpiryDate(
        currentSubscription.expiryDate
      );

    if (expiry) {
      subscriptionSecondary =
        isArabic
          ? `ينتهي في ${expiry}`
          : `Expires ${expiry}`;
    }
  }

  return (
    <main
      dir={
        isArabic
          ? "rtl"
          : "ltr"
      }
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
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                />
              )
            )}
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                icon={
                  <Tv size={22} />
                }
                title={
                  isArabic
                    ? "الاشتراك الحالي"
                    : "Current subscription"
                }
                value={
                  subscriptionValue
                }
                secondaryValue={
                  subscriptionSecondary ||
                  undefined
                }
                iconClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              />

              <DashboardCard
                icon={
                  <Smartphone
                    size={22}
                  />
                }
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
                icon={
                  <CreditCard
                    size={22}
                  />
                }
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
                icon={
                  <Headphones
                    size={22}
                  />
                }
                title={
                  isArabic
                    ? "الدعم"
                    : "Support"
                }
                value={
                  isArabic
                    ? "متوفر يوميًا من 10 صباحًا إلى 11 مساءً"
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
                    : "تصفح الباقات المتوفرة واختر الاشتراك المناسب."
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
                    ? "الأجهزة"
                    : "Devices"
                }
                description={
                  isArabic
                    ? "شوف الأجهزة المتوفرة وتفاصيلها وأسعارها."
                    : "Browse available devices, details, and prices."
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
              <div className="mb-8 grid gap-5 md:grid-cols-2">
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
                          ? "لوحة الإدارة"
                          : "Admin panel"}
                      </h2>

                      <p className="mt-2 max-w-xl text-sm leading-7 text-blue-100">
                        {isArabic
                          ? "تقدر من لوحة الإدارة إدارة العملاء والاشتراكات والباقات والطلبات والأجهزة وباقي أقسام النظام."
                          : "Manage customers, subscriptions, plans, orders, devices, and the rest of the system."}
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

                <DashboardLink
                  href="/admin/devices"
                  title={
                    isArabic
                      ? "إدارة الأجهزة"
                      : "Manage devices"
                  }
                  description={
                    isArabic
                      ? "أضف الأجهزة وعدّلها واحذفها وربطها بباقات VIP."
                      : "Add, edit, delete, and link devices to VIP packages."
                  }
                  icon={
                    <Settings
                      size={22}
                    />
                  }
                />
              </div>
            )}

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {user && (
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <CircleUserRound
                      size={19}
                    />
                  </div>

                  <div>
                    <div className="text-sm font-black">
                      {user.name}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      {user.phone}
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
                <LogOut
                  size={17}
                />

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
  secondaryValue,
  iconClass,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  secondaryValue?: string;
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

      <p className="mt-1 truncate text-xl font-black">
        {value}
      </p>

      {secondaryValue && (
        <p className="mt-2 text-xs font-bold text-slate-400 dark:text-slate-500">
          {secondaryValue}
        </p>
      )}
    </div>
  );
}

function DashboardLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              {icon}
            </div>
          )}

          <div>
            <h2 className="text-lg font-black">
              {title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        <ChevronLeft
          size={22}
          className="shrink-0 text-slate-300 transition group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400"
        />
      </div>
    </Link>
  );
}