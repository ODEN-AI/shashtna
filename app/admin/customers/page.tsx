"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  RefreshCw,
  CalendarDays,
  CircleAlert,
} from "lucide-react";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/customers",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر جلب العملاء"
        );
      }

      setCustomers(data.customers ?? []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب العملاء"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query)
      );
    });
  }, [customers, search]);

  const adminCount = customers.filter(
    (customer) =>
      customer.role.toUpperCase() === "ADMIN"
  ).length;

  const customerCount = customers.length - adminCount;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white lg:p-8"
    >
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowRight size={17} />
            العودة إلى لوحة الإدارة
          </Link>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

            <div className="flex items-center gap-3">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
                <Users size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                  إدارة العملاء
                </h1>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  جميع حسابات المستخدمين المسجلة في شاشتنا.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadCustomers}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-blue-400"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              تحديث
            </button>

          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <CircleAlert size={18} />
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">

          <StatCard
            title="إجمالي الحسابات"
            value={customers.length}
            icon={<Users size={21} />}
          />

          <StatCard
            title="العملاء"
            value={customerCount}
            icon={<UserRound size={21} />}
          />

          <StatCard
            title="المستخدمون الإداريون"
            value={adminCount}
            icon={<ShieldCheck size={21} />}
          />

        </div>

        {/* Search */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="relative">
            <Search
              size={19}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              suppressHydrationWarning
              dir="rtl"
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث بالاسم أو البريد أو رقم الهاتف..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-12 text-right text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
            />
          </div>

        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">

                  <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    العميل
                  </th>

                  <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    التواصل
                  </th>

                  <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    الصلاحية
                  </th>

                  <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    تاريخ التسجيل
                  </th>

                  <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    الإجراءات
                  </th>

                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <LoadingRows />
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-20 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <Users size={25} />
                      </div>

                      <h2 className="mt-4 text-base font-black">
                        لا توجد نتائج
                      </h2>

                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {search
                          ? "جرّب كلمات بحث مختلفة."
                          : "لا توجد حسابات مسجلة حالياً."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                    />
                  ))
                )}
              </tbody>

            </table>
          </div>

          {!loading && filteredCustomers.length > 0 && (
            <div className="border-t border-slate-200 px-6 py-4 text-xs font-semibold text-slate-400 dark:border-slate-800">
              عرض {filteredCustomers.length} من أصل{" "}
              {customers.length} حساب
            </div>
          )}

        </div>

      </div>
    </main>
  );
}

function CustomerRow({
  customer,
}: {
  customer: Customer;
}) {
  const isAdmin =
    customer.role.toUpperCase() === "ADMIN";

  const createdDate = new Date(customer.createdAt);

  const dateText = Number.isNaN(
    createdDate.getTime()
  )
    ? "-"
    : createdDate.toLocaleDateString("ar-IQ");

  return (
    <tr className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">

      <td className="px-6 py-5">
        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            {isAdmin ? (
              <ShieldCheck size={19} />
            ) : (
              <UserRound size={19} />
            )}
          </div>

          <div>
            <div className="text-sm font-black">
              {customer.name}
            </div>

            <div className="mt-1 text-xs text-slate-400">
              #{customer.id}
            </div>
          </div>

        </div>
      </td>

      <td className="px-6 py-5">

        <div className="space-y-2">

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Mail size={14} className="text-slate-400" />
            <span dir="ltr">
              {customer.email}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Phone size={14} className="text-slate-400" />
            <span dir="ltr">
              {customer.phone}
            </span>
          </div>

        </div>

      </td>

      <td className="px-6 py-5">
        {isAdmin ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <ShieldCheck size={13} />
            ADMIN
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <UserRound size={13} />
            CUSTOMER
          </span>
        )}
      </td>

      <td className="px-6 py-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <CalendarDays size={14} />
          {dateText}
        </div>
      </td>

      <td className="px-6 py-5">
        <Link
          href={`/admin/customers/${customer.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-blue-400"
        >
          عرض التفاصيل
          <ArrowRight size={14} />
        </Link>
      </td>

    </tr>
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

      <div className="flex items-center justify-between">

        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-2 text-2xl font-black">
            {value.toLocaleString("en-US")}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          {icon}
        </div>

      </div>

    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3].map((item) => (
        <tr
          key={item}
          className="border-b border-slate-100 dark:border-slate-800"
        >
          {[1, 2, 3, 4, 5].map((cell) => (
            <td key={cell} className="px-6 py-5">
              <div className="h-5 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}