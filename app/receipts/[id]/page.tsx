"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Printer,
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
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function ReceiptDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReceipt() {
      try {
        const rawUser = localStorage.getItem("user");

        if (!rawUser) {
          window.location.href = "/login?redirect=/receipts";
          return;
        }

        const user = JSON.parse(rawUser);

        if (!user?.id) {
          window.location.href = "/login?redirect=/receipts";
          return;
        }

        const routeParams = await params;
        const receiptId = Number(routeParams.id);

        if (!Number.isInteger(receiptId) || receiptId <= 0) {
          setError("رقم الإيصال غير صحيح.");
          return;
        }

        const response = await fetch(
          `/api/receipts?userId=${user.id}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "تعذر تحميل الإيصال."
          );
        }

        const found = (data.receipts as Receipt[]).find(
          (item) => item.id === receiptId
        );

        if (!found) {
          setError("الإيصال غير موجود.");
          return;
        }

        setReceipt(found);
      } catch (error) {
        console.error(error);
        setError("تعذر تحميل بيانات الإيصال.");
      } finally {
        setLoading(false);
      }
    }

    loadReceipt();
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />

          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            جاري تحميل الإيصال...
          </p>
        </div>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
          <ReceiptText className="mx-auto h-10 w-10 text-rose-500" />

          <h1 className="mt-4 text-2xl font-black text-rose-700 dark:text-rose-300">
            الإيصال غير موجود
          </h1>

          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
            {error || "لم يتم العثور على الإيصال."}
          </p>

          <Link
            href="/receipts"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للإيصالات
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/receipts"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للإيصالات
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            طباعة الإيصال
          </button>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-0 print:shadow-none">
          <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 px-6 py-10 text-white dark:border-slate-800 sm:px-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

            <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <ReceiptText className="h-6 w-6" />

                  <span className="text-sm font-bold text-white/80">
                    شاشتنا
                  </span>
                </div>

                <h1 className="text-3xl font-black sm:text-4xl">
                  إيصال الدفع
                </h1>

                <p className="mt-2 text-sm text-white/75">
                  {receipt.receiptNumber}
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black backdrop-blur">
                <CheckCircle2 className="h-4 w-4" />
                مدفوع
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950">
                <p className="text-xs font-bold text-slate-400">
                  الخدمة
                </p>

                <p className="mt-2 text-xl font-black">
                  {receipt.serviceName}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950">
                <p className="text-xs font-bold text-slate-400">
                  المبلغ المدفوع
                </p>

                <p className="mt-2 text-xl font-black text-blue-700 dark:text-blue-300">
                  {formatPrice(receipt.price)} د.ع
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950">
                <p className="text-xs font-bold text-slate-400">
                  مدة الاشتراك
                </p>

                <p className="mt-2 text-lg font-black">
                  {receipt.durationLabel}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950">
                <p className="text-xs font-bold text-slate-400">
                  تاريخ الشراء
                </p>

                <p className="mt-2 inline-flex items-center gap-2 text-sm font-black">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  {formatDate(receipt.createdAt)}
                </p>
              </div>
            </div>

            <div className="my-8 h-px bg-slate-200 dark:bg-slate-800" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-slate-400">
                  رقم الاشتراك
                </p>

                <p className="mt-1 font-black">
                  #{receipt.subscriptionId}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400">
                  رقم الإيصال
                </p>

                <p className="mt-1 font-black">
                  {receipt.receiptNumber}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm leading-7 text-blue-900 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-200">
              هذا الإيصال يثبت تسجيل عملية الاشتراك
              بنجاح لدى شاشتنا.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}