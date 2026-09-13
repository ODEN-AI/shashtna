"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { useEffect, useState } from "react";

type Receipt = {
  id: number;
  receiptNumber: string;
  serviceName: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  status: string;
  createdAt: string;
  subscriptionId: number;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("ar-IQ").format(price);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] =
    useState<Receipt[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadReceipts() {
      try {
        const rawUser =
          localStorage.getItem("user");

        if (!rawUser) {
          window.location.href =
            "/login?redirect=/receipts";
          return;
        }

        const user = JSON.parse(rawUser);

        if (!user?.id) {
          window.location.href =
            "/login?redirect=/receipts";
          return;
        }

        const response = await fetch(
          `/api/receipts?userId=${user.id}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "تعذر تحميل الإيصالات."
          );
        }

        setReceipts(
          data.receipts ?? []
        );
      } catch (error) {
        console.error(error);

        setError(
          "تعذر تحميل الإيصالات حالياً."
        );
      } finally {
        setLoading(false);
      }
    }

    loadReceipts();
  }, []);

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm dark:border-blue-900/40 dark:bg-slate-900/70 dark:text-blue-300">
              <ReceiptText className="h-4 w-4" />
              حسابك
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              إيصالاتي
            </h1>

            <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
              هنا تگدر تشوف كل عمليات الشراء
              والإيصالات الخاصة باشتراكاتك.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للحساب
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />

            <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
              جاري تحميل الإيصالات...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
            <h2 className="text-xl font-black text-rose-700 dark:text-rose-300">
              تعذر تحميل الإيصالات
            </h2>

            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />

            <h2 className="mt-4 text-xl font-black">
              لا توجد إيصالات
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
              من تسوي أول عملية اشتراك راح يظهر
              الإيصال هنا تلقائياً.
            </p>

            <Link
              href="/plans"
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
            >
              مشاهدة الباقات
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/40">
                      <ReceiptText className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black">
                          {receipt.serviceName}
                        </h2>

                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          مدفوع
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {receipt.receiptNumber}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">
                          {formatPrice(
                            receipt.price
                          )}{" "}
                          د.ع
                        </span>

                        <span>
                          {receipt.durationLabel}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" />
                          {formatDate(
                            receipt.createdAt
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/receipts/${receipt.id}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
                  >
                    <FileText className="h-4 w-4" />
                    عرض الإيصال
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}