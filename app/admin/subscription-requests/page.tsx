"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Search,
  User,
  XCircle,
  Phone,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SubscriptionRequest = {
  id: number;
  userId: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  planSlug: string;
  serviceName: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  contactMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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

function getStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "بانتظار المعالجة";
    case "ACCEPTED":
      return "تم القبول";
    case "REJECTED":
      return "مرفوض";
    default:
      return status;
  }
}

function getContactLabel(method: string) {
  switch (method) {
    case "TELEGRAM":
      return "Telegram";
    case "FACEBOOK":
      return "Facebook";
    case "PENDING":
      return "لم يحدد";
    default:
      return method;
  }
}

export default function SubscriptionRequestsPage() {
  const [requests, setRequests] = useState<
    SubscriptionRequest[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] =
    useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadRequests() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/subscription-requests",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر تحميل الطلبات."
        );
      }

      setRequests(data.requests ?? []);
    } catch (error) {
      console.error(error);
      setError("تعذر تحميل طلبات الاشتراك.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const userRaw = localStorage.getItem("user");

    if (!userRaw) {
      window.location.href = "/login";
      return;
    }

    try {
      const user = JSON.parse(userRaw);

      if (user?.role !== "ADMIN") {
        window.location.href = "/dashboard";
        return;
      }
    } catch {
      window.location.href = "/login";
      return;
    }

    loadRequests();
  }, []);

  async function rejectRequest(id: number) {
    const confirmed = window.confirm(
      "هل أنت متأكد من رفض طلب الاشتراك؟"
    );

    if (!confirmed) {
      return;
    }

    try {
      setRejectingId(id);
      setError("");

      const response = await fetch(
        `/api/admin/subscription-requests/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "REJECTED",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر رفض الطلب."
        );
      }

      setRequests((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "REJECTED",
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      setError("تعذر رفض الطلب.");
    } finally {
      setRejectingId(null);
    }
  }

  const filteredRequests = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return requests;
    }

    return requests.filter((request) => {
      return (
        request.customerName
          .toLowerCase()
          .includes(value) ||
        request.customerPhone
          .toLowerCase()
          .includes(value) ||
        request.customerEmail
          .toLowerCase()
          .includes(value) ||
        request.serviceName
          .toLowerCase()
          .includes(value) ||
        request.planSlug
          .toLowerCase()
          .includes(value)
      );
    });
  }, [requests, search]);

  const pendingCount = requests.filter(
    (item) => item.status === "PENDING"
  ).length;

  const acceptedCount = requests.filter(
    (item) => item.status === "ACCEPTED"
  ).length;

  const rejectedCount = requests.filter(
    (item) => item.status === "REJECTED"
  ).length;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm dark:border-blue-900/40 dark:bg-slate-900/70 dark:text-blue-300">
              <ShoppingCart className="h-4 w-4" />
              إدارة الاشتراكات
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              طلبات الاشتراك
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
              من هنا تراجع طلبات العملاء، تقبل الطلب حتى
              تضيف الاشتراك، أو ترفضه عند الحاجة.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للأدمن
          </Link>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm dark:border-blue-900/30 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  بانتظار المعالجة
                </p>
                <p className="mt-2 text-3xl font-black text-blue-700 dark:text-blue-300">
                  {pendingCount}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/50">
                <Clock3 className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900/30 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  المقبولة
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-300">
                  {acceptedCount}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm dark:border-rose-900/30 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  المرفوضة
                </p>
                <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-300">
                  {rejectedCount}
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/40">
                <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-300" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث بالاسم أو الهاتف أو البريد أو الخدمة..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
            />
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="mt-4 text-sm font-semibold text-slate-500">
              جاري تحميل الطلبات...
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <ShoppingCart className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h2 className="mt-4 text-xl font-black">
              لا توجد طلبات
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              لا توجد طلبات تطابق البحث الحالي.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const pending =
                request.status === "PENDING";

              return (
                <div
                  key={request.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          طلب #{request.id}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {getStatusLabel(request.status)}
                        </span>

                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                          {getContactLabel(
                            request.contactMethod
                          )}
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-400">
                            العميل
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-500" />
                            <p className="font-black">
                              {request.customerName}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-400">
                            الخدمة
                          </p>
                          <p className="mt-1 font-black">
                            {request.serviceName}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-400">
                            السعر
                          </p>
                          <p className="mt-1 font-black text-blue-700 dark:text-blue-300">
                            {formatPrice(request.price)} د.ع
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-400">
                            المدة
                          </p>
                          <p className="mt-1 font-black">
                            {request.durationLabel}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-slate-500 dark:text-slate-400 md:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {request.customerPhone || "—"}
                        </div>

                        <div className="flex items-center gap-2 break-all">
                          <Mail className="h-4 w-4" />
                          {request.customerEmail || "—"}
                        </div>

                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          {formatDate(request.createdAt)}
                        </div>
                      </div>
                    </div>

                    {pending ? (
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
                        <Link
                          href={`/admin/subscription-requests/${request.id}/add`}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          قبول وإضافة الاشتراك
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            rejectRequest(request.id)
                          }
                          disabled={
                            rejectingId === request.id
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
                        >
                          <XCircle className="h-4 w-4" />
                          {rejectingId === request.id
                            ? "جاري الرفض..."
                            : "رفض الطلب"}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                        تمت معالجة الطلب
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}