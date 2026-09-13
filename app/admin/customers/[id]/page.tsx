"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function CustomerDetailsPage() {
  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const pathParts =
          window.location.pathname.split("/");

        const id =
          pathParts[pathParts.length - 1];

        const response = await fetch(
          "/api/admin/customers",
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "تعذر جلب بيانات العملاء"
          );
        }

        const found = data.customers?.find(
          (item: Customer) =>
            String(item.id) === String(id)
        );

        if (!found) {
          throw new Error(
            "العميل غير موجود"
          );
        }

        setCustomer(found);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "حدث خطأ أثناء جلب بيانات العميل"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white lg:p-8"
    >
      <div className="mx-auto max-w-5xl">

        <Link
          href="/admin/customers"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowRight size={17} />
          العودة إلى العملاء
        </Link>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-4 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/30">

            <h1 className="text-xl font-black text-red-700 dark:text-red-400">
              تعذر فتح العميل
            </h1>

            <p className="mt-2 text-sm text-red-600 dark:text-red-400/80">
              {error}
            </p>

          </div>
        ) : customer ? (
          <>

            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  {customer.role.toUpperCase() === "ADMIN" ? (
                    <ShieldCheck size={28} />
                  ) : (
                    <UserRound size={28} />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">

                    <h1 className="text-2xl font-black">
                      {customer.name}
                    </h1>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                      {customer.role.toUpperCase()}
                    </span>

                  </div>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    معرف الحساب: #{customer.id}
                  </p>
                </div>

              </div>

            </div>

            <div className="grid gap-5 md:grid-cols-2">

              <InfoCard
                icon={<Mail size={20} />}
                label="البريد الإلكتروني"
                value={customer.email}
                ltr
              />

              <InfoCard
                icon={<Phone size={20} />}
                label="رقم الهاتف"
                value={customer.phone}
                ltr
              />

              <InfoCard
                icon={<ShieldCheck size={20} />}
                label="الصلاحية"
                value={customer.role.toUpperCase()}
              />

              <InfoCard
                icon={<CalendarDays size={20} />}
                label="تاريخ التسجيل"
                value={new Date(
                  customer.createdAt
                ).toLocaleDateString("ar-IQ")}
              />

            </div>

          </>
        ) : null}

      </div>
    </main>
  );
}

function InfoCard({
  icon,
  label,
  value,
  ltr,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

      <div className="flex items-center gap-3">

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          {icon}
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400">
            {label}
          </p>

          <p
            className={`mt-1 text-sm font-black ${
              ltr ? "text-left" : ""
            }`}
            dir={ltr ? "ltr" : "rtl"}
          >
            {value}
          </p>
        </div>

      </div>

    </div>
  );
}