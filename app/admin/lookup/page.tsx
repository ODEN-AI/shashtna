"use client";

import { FormEvent, useState } from "react";
import {
  Search,
  User,
  CreditCard,
  CalendarDays,
  Monitor,
  Wifi,
  KeyRound,
} from "lucide-react";

type SubscriptionResult = {
  subscription: {
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
  };
  customer: {
    id: number;
    name: string;
    phone: string;
    email: string;
  } | null;
};

export default function AdminLookupPage() {
  const [searchType, setSearchType] = useState<"mac" | "credentials">("mac");

  const [mac, setMac] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubscriptionResult | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/subscriptions/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          searchType === "mac"
            ? {
                mac,
              }
            : {
                username,
                password,
              }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "حدث خطأ أثناء البحث");
      }

      setResult(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء البحث"
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "ACTIVE":
        return "نشط";

      case "EXPIRED":
        return "منتهي";

      case "SUSPENDED":
        return "موقوف";

      default:
        return status;
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "EXPIRED":
        return "bg-red-50 text-red-700 border-red-200";

      case "SUSPENDED":
        return "bg-amber-50 text-amber-700 border-amber-200";

      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-4 md:p-8"
    >
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Search size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                البحث عن اشتراك
              </h1>

              <p className="text-sm text-slate-500">
                ابحث عن اشتراك العميل باستخدام MAC أو بيانات الدخول
              </p>
            </div>

          </div>
        </div>

        {/* Search Card */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-slate-200">

            <button
              type="button"
              onClick={() => {
                setSearchType("mac");
                setError("");
                setResult(null);
              }}
              className={`flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition ${
                searchType === "mac"
                  ? "border-b-2 border-blue-600 bg-blue-50/50 text-blue-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Monitor size={18} />
              البحث بـ MAC Address
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchType("credentials");
                setError("");
                setResult(null);
              }}
              className={`flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition ${
                searchType === "credentials"
                  ? "border-b-2 border-blue-600 bg-blue-50/50 text-blue-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <KeyRound size={18} />
              Username + Password
            </button>

          </div>

          {/* Form */}
          <form
            onSubmit={handleSearch}
            className="p-6 md:p-8"
          >

            {searchType === "mac" ? (

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  MAC Address
                </label>

                <input
                  type="text"
                  value={mac}
                  onChange={(event) => setMac(event.target.value)}
                  placeholder="مثال: 00:11:22:33:44:55"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  dir="ltr"
                />

              </div>

            ) : (

              <div className="grid gap-5 md:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Username
                  </label>

                  <input
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value)
                    }
                    placeholder="Username"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    dir="ltr"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <input
                    type="text"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Password"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    dir="ltr"
                  />

                </div>

              </div>

            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search size={19} />

              {loading
                ? "جاري البحث..."
                : "بحث عن الاشتراك"}
            </button>

          </form>

        </section>

        {/* Result */}
        {result && (

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            {/* Result Header */}
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-sm text-slate-500">
                  نتيجة البحث
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {result.subscription.username}
                </h2>

              </div>

              <span
                className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${getStatusStyle(
                  result.subscription.status
                )}`}
              >
                {getStatusLabel(result.subscription.status)}
              </span>

            </div>

            {/* Information */}
            <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">

              <InfoCard
                icon={<User size={19} />}
                title="العميل"
                value={result.customer?.name ?? "غير مرتبط"}
              />

              <InfoCard
                icon={<Wifi size={19} />}
                title="رقم الهاتف"
                value={result.customer?.phone ?? "—"}
                direction="ltr"
              />

              <InfoCard
                icon={<CreditCard size={19} />}
                title="الباقة"
                value={result.subscription.packageName}
              />

              <InfoCard
                icon={<KeyRound size={19} />}
                title="Username"
                value={result.subscription.username}
                direction="ltr"
              />

              <InfoCard
                icon={<KeyRound size={19} />}
                title="Password"
                value={result.subscription.password}
                direction="ltr"
              />

              <InfoCard
                icon={<Monitor size={19} />}
                title="MAC Address"
                value={result.subscription.macAddress ?? "غير موجود"}
                direction="ltr"
              />

              <InfoCard
                icon={<CalendarDays size={19} />}
                title="تاريخ البداية"
                value={formatDate(result.subscription.startDate)}
              />

              <InfoCard
                icon={<CalendarDays size={19} />}
                title="تاريخ الانتهاء"
                value={formatDate(result.subscription.expiryDate)}
              />

              <InfoCard
                icon={<Wifi size={19} />}
                title="الاتصالات"
                value={`${result.subscription.connections} / ${result.subscription.maxConnections}`}
                direction="ltr"
              />

            </div>

            {/* Actions */}
            <div className="border-t border-slate-200 bg-slate-50 p-6">

              <div className="flex flex-col gap-3 md:flex-row">

                <button
                  type="button"
                  className="flex-1 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700"
                >
                  تجديد الاشتراك
                </button>

                <button
                  type="button"
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  عرض تفاصيل العميل
                </button>

              </div>

            </div>

          </section>

        )}

      </div>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  value,
  direction = "rtl",
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  direction?: "rtl" | "ltr";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

      <div className="mb-3 flex items-center gap-2 text-slate-500">
        {icon}

        <span className="text-sm font-semibold">
          {title}
        </span>
      </div>

      <div
        dir={direction}
        className="break-all text-sm font-bold text-slate-900"
      >
        {value}
      </div>

    </div>
  );
}