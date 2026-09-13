"use client";

import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Tv,
  UserRound,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Subscription = {
  id: number;
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ar-IQ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<
    Subscription[]
  >([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/subscriptions",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر جلب الاشتراكات"
        );
      }

      setSubscriptions(data.subscriptions ?? []);
    } catch (error) {
      console.error("Admin subscriptions error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء جلب الاشتراكات"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredSubscriptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return subscriptions;
    }

    return subscriptions.filter((subscription) => {
      return (
        subscription.customerName
          .toLowerCase()
          .includes(query) ||
        subscription.customerEmail
          .toLowerCase()
          .includes(query) ||
        subscription.customerPhone
          .toLowerCase()
          .includes(query) ||
        subscription.username
          .toLowerCase()
          .includes(query) ||
        subscription.macAddress
          ?.toLowerCase()
          .includes(query) ||
        subscription.packageName
          .toLowerCase()
          .includes(query)
      );
    });
  }, [subscriptions, search]);

  const activeCount = subscriptions.filter(
    (item) => {
      const status = item.status.toUpperCase();

      return (
        status === "ACTIVE" &&
        new Date(item.expiryDate) >= new Date()
      );
    }
  ).length;

  const expiredCount = subscriptions.filter(
    (item) => {
      const expiry = new Date(item.expiryDate);

      return (
        item.status.toUpperCase() === "EXPIRED" ||
        (!Number.isNaN(expiry.getTime()) &&
          expiry < new Date())
      );
    }
  ).length;

  const otherCount =
    subscriptions.length -
    activeCount -
    expiredCount;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white lg:p-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link
            href="/admin"
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← العودة إلى لوحة الإدارة
          </Link>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
                <Tv size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                  إدارة الاشتراكات
                </h1>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  إدارة اشتراكات العملاء وحالاتها وتفاصيلها.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadSubscriptions}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-blue-400"
            >
              <RefreshCw
                size={17}
                className={
                  loading ? "animate-spin" : ""
                }
              />

              تحديث
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <CircleAlert size={18} />
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="إجمالي الاشتراكات"
            value={subscriptions.length}
            icon={<Tv size={21} />}
          />

          <StatCard
            title="النشطة"
            value={activeCount}
            icon={<CircleCheck size={21} />}
          />

          <StatCard
            title="المنتهية"
            value={expiredCount}
            icon={<CircleX size={21} />}
          />

          <StatCard
            title="أخرى"
            value={otherCount}
            icon={<Wifi size={21} />}
          />
        </div>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative">
            <Search
              size={19}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              dir="rtl"
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث بالعميل أو Username أو MAC أو الباقة..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-12 text-right text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-right">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                  <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    العميل
                  </th>

                  <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    بيانات الاشتراك
                  </th>

                  <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    الباقة
                  </th>

                  <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    الحالة
                  </th>

                  <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    المدة
                  </th>

                  <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    الاتصالات
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <LoadingRows />
                ) : filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-20 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <Tv size={25} />
                      </div>

                      <h2 className="mt-4 text-base font-black">
                        لا توجد اشتراكات
                      </h2>

                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {search
                          ? "جرّب كلمات بحث مختلفة."
                          : "لا توجد اشتراكات مسجلة حالياً."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map(
                    (subscription) => (
                      <SubscriptionRow
                        key={subscription.id}
                        subscription={subscription}
                      />
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {!loading &&
            filteredSubscriptions.length > 0 && (
              <div className="border-t border-slate-200 px-6 py-4 text-xs font-semibold text-slate-400 dark:border-slate-800">
                عرض {filteredSubscriptions.length} من أصل{" "}
                {subscriptions.length} اشتراك
              </div>
            )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-2 text-3xl font-black">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SubscriptionRow({
  subscription,
}: {
  subscription: Subscription;
}) {
  const [showPassword, setShowPassword] =
    useState(false);

  const expiryDate = new Date(
    subscription.expiryDate
  );

  const expired =
    !Number.isNaN(expiryDate.getTime()) &&
    expiryDate < new Date();

  const status =
    expired
      ? "EXPIRED"
      : subscription.status.toUpperCase();

  const statusClass =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      : status === "EXPIRED"
        ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <tr className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <td className="px-5 py-5 align-top">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <UserRound size={18} />
          </div>

          <div>
            <div className="font-black">
              {subscription.customerName}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {subscription.customerEmail}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {subscription.customerPhone}
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-bold text-slate-400">
              Username:
            </span>{" "}
            <span className="font-black">
              {subscription.username}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">
              Password:
            </span>

            <span className="font-black">
              {showPassword
                ? subscription.password
                : "••••••••"}
            </span>

            <button
              type="button"
              onClick={() =>
                setShowPassword((value) => !value)
              }
              className="text-slate-400 transition hover:text-blue-600"
              title={
                showPassword
                  ? "إخفاء كلمة المرور"
                  : "إظهار كلمة المرور"
              }
            >
              {showPassword ? (
                <EyeOff size={15} />
              ) : (
                <Eye size={15} />
              )}
            </button>
          </div>

          <div>
            <span className="font-bold text-slate-400">
              MAC:
            </span>{" "}
            <span className="font-black">
              {subscription.macAddress || "—"}
            </span>
          </div>
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <div className="font-black">
          {subscription.packageName}
        </div>

        <div className="mt-1 text-xs text-slate-400">
          ID #{subscription.id}
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${statusClass}`}
        >
          {status === "ACTIVE"
            ? "نشط"
            : status === "EXPIRED"
              ? "منتهي"
              : status}
        </span>

        <div className="mt-2 text-xs text-slate-400">
          آخر تحديث:{" "}
          {formatDateTime(subscription.updatedAt)}
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <CalendarDays size={15} />

          {formatDate(subscription.startDate)}
        </div>

        <div className="mt-2 text-xs font-black text-slate-700 dark:text-slate-200">
          ينتهي: {formatDate(subscription.expiryDate)}
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400">
            <Wifi size={16} />
          </div>

          <div>
            <div className="text-sm font-black">
              {subscription.connections} /{" "}
              {subscription.maxConnections}
            </div>

            <div className="text-xs text-slate-400">
              اتصال
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3, 4].map((row) => (
        <tr key={row}>
          {Array.from({ length: 6 }).map(
            (_, column) => (
              <td
                key={column}
                className="px-5 py-6"
              >
                <div className="h-5 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </td>
            )
          )}
        </tr>
      ))}
    </>
  );
}