"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  ReceiptText,
  Tv,
  UserRound,
  Wifi,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useLanguage } from "../components/LanguageProvider";

type Subscription = {
  id: number;
  username: string;
  password: string;
  macAddress: string | null;
  status: string;
  packageName: string;
  startDate: string;
  expiryDate: string;
  connections: number;
  maxConnections: number;
  createdAt: string;
  updatedAt: string;
};

type UserData = {
  id: number;
  name: string;
  email: string;
};

function formatDate(
  date: string,
  isArabic: boolean
) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return isArabic
      ? "تاريخ غير صالح"
      : "Invalid date";
  }

  return new Intl.DateTimeFormat(
    isArabic ? "ar-IQ" : "en-US",
    {
      dateStyle: "medium",
    }
  ).format(parsedDate);
}

function getRemainingDays(expiryDate: string) {
  const now = new Date();

  const expiry = new Date(
    `${expiryDate.slice(0, 10)}T23:59:59`
  );

  if (Number.isNaN(expiry.getTime())) {
    return 0;
  }

  const difference =
    expiry.getTime() - now.getTime();

  return Math.max(
    0,
    Math.ceil(
      difference / (1000 * 60 * 60 * 24)
    )
  );
}

function getSubscriptionState(
  subscription: Subscription
) {
  const remainingDays = getRemainingDays(
    subscription.expiryDate
  );

  const status =
    subscription.status?.toUpperCase?.() ?? "";

  if (
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    remainingDays <= 0
  ) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

export default function SubscriptionsPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  const [user, setUser] =
    useState<UserData | null>(null);

  const [subscriptions, setSubscriptions] =
    useState<Subscription[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [visiblePasswords, setVisiblePasswords] =
    useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadSubscriptions() {
      try {
        setLoading(true);
        setError("");

        const rawUser =
          window.localStorage.getItem("user");

        if (!rawUser) {
          window.location.href =
            "/login?redirect=/subscriptions";
          return;
        }

        let parsedUser: UserData;

        try {
          parsedUser = JSON.parse(
            rawUser
          ) as UserData;
        } catch {
          window.localStorage.removeItem(
            "user"
          );

          window.location.href =
            "/login?redirect=/subscriptions";

          return;
        }

        if (
          !parsedUser ||
          !Number.isFinite(
            Number(parsedUser.id)
          ) ||
          Number(parsedUser.id) <= 0
        ) {
          window.localStorage.removeItem(
            "user"
          );

          window.location.href =
            "/login?redirect=/subscriptions";

          return;
        }

        const normalizedUser: UserData = {
          id: Number(parsedUser.id),
          name: parsedUser.name ?? "",
          email: parsedUser.email ?? "",
        };

        if (cancelled) {
          return;
        }

        setUser(normalizedUser);

        const controller =
          new AbortController();

        const timeout = window.setTimeout(
          () => {
            controller.abort();
          },
          10000
        );

        try {
          const response = await fetch(
            `/api/subscriptions?userId=${normalizedUser.id}`,
            {
              method: "GET",
              cache: "no-store",
              signal: controller.signal,
              headers: {
                Accept: "application/json",
              },
            }
          );

          const contentType =
            response.headers.get(
              "content-type"
            ) ?? "";

          if (!contentType.includes(
            "application/json"
          )) {
            throw new Error(
              "API did not return JSON."
            );
          }

          const data = await response.json();

          if (!response.ok || !data?.success) {
            throw new Error(
              data?.message ||
                "تعذر تحميل الاشتراكات."
            );
          }

          const receivedSubscriptions =
            Array.isArray(data.subscriptions)
              ? data.subscriptions
              : [];

          if (cancelled) {
            return;
          }

          setSubscriptions(
            receivedSubscriptions
          );
        } finally {
          window.clearTimeout(timeout);
        }
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        console.error(
          "Subscriptions page error:",
          requestError
        );

        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          setError(
            isArabic
              ? "استغرق تحميل الاشتراكات وقتاً أطول من اللازم."
              : "Loading your subscriptions took too long."
          );
        } else {
          setError(
            isArabic
              ? "تعذر تحميل اشتراكاتك حالياً."
              : "Unable to load your subscriptions right now."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSubscriptions();

    return () => {
      cancelled = true;
    };
  }, []);

  function togglePassword(id: number) {
    setVisiblePasswords((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (copyError) {
      console.error(
        "Copy failed:",
        copyError
      );
    }
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm dark:border-blue-900/40 dark:bg-slate-900/70 dark:text-blue-300">
              <Tv className="h-4 w-4" />

              {isArabic
                ? "حسابي"
                : "My account"}
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {isArabic
                ? "اشتراكاتي"
                : "My subscriptions"}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
              {isArabic
                ? "تابع اشتراكاتك الحالية، بيانات الدخول، مدة الاشتراك، وتاريخ الانتهاء."
                : "Track your active subscriptions, login details, subscription duration, and expiry dates."}
            </p>

            {user ? (
              <p className="mt-3 text-sm font-bold text-slate-400">
                {user.name}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/receipts"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ReceiptText className="h-4 w-4" />

              {isArabic
                ? "إيصالاتي"
                : "My receipts"}
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />

              {isArabic
                ? "الحساب"
                : "Dashboard"}
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />

            <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {isArabic
                ? "جاري تحميل الاشتراكات..."
                : "Loading subscriptions..."}
            </p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
            <XCircle className="mx-auto h-10 w-10 text-rose-500" />

            <h2 className="mt-4 text-xl font-black text-rose-700 dark:text-rose-300">
              {isArabic
                ? "تعذر تحميل الاشتراكات"
                : "Unable to load subscriptions"}
            </h2>

            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>

            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
            >
              {isArabic
                ? "إعادة المحاولة"
                : "Try again"}
            </button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Tv className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />

            <h2 className="mt-4 text-xl font-black">
              {isArabic
                ? "ما عندك اشتراكات حالياً"
                : "You have no subscriptions yet"}
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500 dark:text-slate-400">
              {isArabic
                ? "من تشترك بخدمة راح تظهر بيانات اشتراكك هنا تلقائياً."
                : "Once you subscribe to a service, your subscription details will appear here automatically."}
            </p>

            <Link
              href="/plans"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              {isArabic
                ? "تصفح الباقات"
                : "Browse plans"}
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {subscriptions.map(
              (subscription) => {
                const state =
                  getSubscriptionState(
                    subscription
                  );

                const active =
                  state === "ACTIVE";

                const remainingDays =
                  getRemainingDays(
                    subscription.expiryDate
                  );

                return (
                  <article
                    key={subscription.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 px-6 py-6 text-white">
                      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

                      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">
                              {isArabic
                                ? `اشتراك #${subscription.id}`
                                : `Subscription #${subscription.id}`}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                                active
                                  ? "bg-emerald-400/20 text-emerald-100"
                                  : "bg-rose-400/20 text-rose-100"
                              }`}
                            >
                              {active ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}

                              {active
                                ? isArabic
                                  ? "فعال"
                                  : "Active"
                                : isArabic
                                ? "منتهي"
                                : "Expired"}
                            </span>
                          </div>

                          <h2 className="mt-3 text-2xl font-black">
                            {subscription.packageName}
                          </h2>

                          <p className="mt-1 text-sm text-white/75">
                            {isArabic
                              ? `متبقي ${remainingDays} يوم`
                              : `${remainingDays} days remaining`}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
                          <p className="text-xs font-bold text-white/65">
                            {isArabic
                              ? "الحالة"
                              : "Status"}
                          </p>

                          <p className="mt-1 text-lg font-black">
                            {active
                              ? isArabic
                                ? "الاشتراك يعمل"
                                : "Subscription active"
                              : isArabic
                              ? "الاشتراك منتهي"
                              : "Subscription expired"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                          <div className="mb-4 flex items-center gap-2">
                            <UserRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />

                            <h3 className="font-black">
                              {isArabic
                                ? "بيانات الدخول"
                                : "Login details"}
                            </h3>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="mb-1 text-xs font-bold text-slate-400">
                                {isArabic
                                  ? "اسم المستخدم"
                                  : "Username"}
                              </p>

                              <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-black dark:bg-slate-900">
                                  {
                                    subscription.username
                                  }
                                </code>

                                <button
                                  type="button"
                                  onClick={() =>
                                    copyText(
                                      subscription.username
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900"
                                  title={
                                    isArabic
                                      ? "نسخ"
                                      : "Copy"
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="mb-1 text-xs font-bold text-slate-400">
                                {isArabic
                                  ? "كلمة المرور"
                                  : "Password"}
                              </p>

                              <div className="flex items-center gap-2">
                                <code className="flex-1 overflow-hidden rounded-xl bg-white px-3 py-2.5 text-sm font-black tracking-wider dark:bg-slate-900">
                                  {visiblePasswords[
                                    subscription.id
                                  ]
                                    ? subscription.password
                                    : "••••••••••"}
                                </code>

                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePassword(
                                      subscription.id
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900"
                                  title={
                                    visiblePasswords[
                                      subscription.id
                                    ]
                                      ? isArabic
                                        ? "إخفاء"
                                        : "Hide"
                                      : isArabic
                                      ? "إظهار"
                                      : "Show"
                                  }
                                >
                                  {visiblePasswords[
                                    subscription.id
                                  ] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    copyText(
                                      subscription.password
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900"
                                  title={
                                    isArabic
                                      ? "نسخ"
                                      : "Copy"
                                  }
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="mb-1 text-xs font-bold text-slate-400">
                                MAC Address
                              </p>

                              <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-black dark:bg-slate-900">
                                  {
                                    subscription.macAddress ||
                                    (isArabic
                                      ? "غير محدد"
                                      : "Not provided")
                                  }
                                </code>

                                {subscription.macAddress ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyText(
                                        subscription.macAddress as string
                                      )
                                    }
                                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                          <div className="mb-4 flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />

                            <h3 className="font-black">
                              {isArabic
                                ? "مدة الاشتراك"
                                : "Subscription period"}
                            </h3>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                {isArabic
                                  ? "تاريخ البداية"
                                  : "Start date"}
                              </p>

                              <p className="mt-1 font-black">
                                {formatDate(
                                  subscription.startDate,
                                  isArabic
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                {isArabic
                                  ? "تاريخ الانتهاء"
                                  : "Expiry date"}
                              </p>

                              <p
                                className={`mt-1 font-black ${
                                  active
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {formatDate(
                                  subscription.expiryDate,
                                  isArabic
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                {isArabic
                                  ? "الأيام المتبقية"
                                  : "Days remaining"}
                              </p>

                              <p className="mt-1 text-2xl font-black text-blue-700 dark:text-blue-300">
                                {remainingDays}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                {isArabic
                                  ? "الاتصالات"
                                  : "Connections"}
                              </p>

                              <div className="mt-2 flex items-center gap-2">
                                <Wifi className="h-4 w-4 text-blue-600" />

                                <span className="font-black">
                                  {
                                    subscription.connections
                                  }{" "}
                                  /{" "}
                                  {
                                    subscription.maxConnections
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Link
                          href={`/subscriptions/${subscription.id}`}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                        >
                          <Eye className="h-4 w-4" />

                          {isArabic
                            ? "تفاصيل الاشتراك"
                            : "Subscription details"}
                        </Link>

                        <Link
                          href="/receipts"
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ReceiptText className="h-4 w-4" />

                          {isArabic
                            ? "الإيصالات"
                            : "Receipts"}
                        </Link>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-200 pt-5 text-xs font-semibold text-slate-400 dark:border-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <MonitorSmartphone className="h-3.5 w-3.5" />

                          {isArabic
                            ? "حساب واحد"
                            : "Single account"}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5" />

                          {isArabic
                            ? "بيانات الدخول محفوظة"
                            : "Login credentials available"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>
    </main>
  );
}