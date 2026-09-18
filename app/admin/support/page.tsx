"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Headphones,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  UserRound,
  X,
} from "lucide-react";

type SupportMessage = {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  senderName: string | null;
  message: string;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  userId: number;
  userName: string;
  userPhone: string;
  subject: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  lastSender: "CUSTOMER" | "ADMIN";
  messages: SupportMessage[];
};

type Filter = "ALL" | "OPEN" | "IN_PROGRESS" | "CLOSED";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: SupportTicket["status"]) {
  if (status === "IN_PROGRESS") return "قيد المعالجة";
  if (status === "CLOSED") return "مغلقة";
  return "مفتوحة";
}

function categoryLabel(category: string) {
  if (category === "subscription") return "مشكلة اشتراك";
  if (category === "device") return "مشكلة جهاز";
  return "استفسار عام";
}

function statusClasses(status: SupportTicket["status"]) {
  if (status === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (status === "CLOSED") {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export default function AdminSupportPage() {
  const [adminUserId, setAdminUserId] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");

      if (!raw) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const user = JSON.parse(raw);
      const id = Number(user?.id);
      const isAdmin =
        Number.isInteger(id) &&
        id > 0 &&
        String(user?.role ?? "").toUpperCase() === "ADMIN";

      setAuthorized(isAdmin);

      if (isAdmin) {
        setAdminUserId(id);
      }
    } catch {
      setAuthorized(false);
      setLoading(false);
    }
  }, []);

  async function loadTickets(
    nextFilter: Filter = filter,
  ) {
    if (!adminUserId) return;

    try {
      setLoading(true);
      setError("");

      const query = new URLSearchParams({
        adminUserId: String(adminUserId),
        status: nextFilter,
      });

      const response = await fetch(
        `/api/admin/support/tickets?${query.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر تحميل تذاكر الدعم.",
        );
      }

      setTickets(
        Array.isArray(data.tickets)
          ? data.tickets
          : [],
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحميل تذاكر الدعم.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminUserId) {
      void loadTickets(filter);
    }
  }, [adminUserId]);

  const counts = useMemo(() => {
    return tickets.reduce(
      (acc, ticket) => {
        acc.all += 1;
        if (ticket.status === "OPEN") acc.open += 1;
        if (ticket.status === "IN_PROGRESS") acc.inProgress += 1;
        if (ticket.status === "CLOSED") acc.closed += 1;
        return acc;
      },
      { all: 0, open: 0, inProgress: 0, closed: 0 },
    );
  }, [tickets]);

  async function openTicket(id: string) {
    if (!adminUserId) return;

    try {
      setError("");

      const query = new URLSearchParams({
        adminUserId: String(adminUserId),
      });

      const response = await fetch(
        `/api/admin/support/tickets/${encodeURIComponent(id)}?${query.toString()}`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر فتح التذكرة.",
        );
      }

      setSelectedTicket(data.ticket);
      setReply("");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "تعذر فتح التذكرة.",
      );
    }
  }

  async function updateTicket(
    status?: SupportTicket["status"],
  ) {
    if (!adminUserId || !selectedTicket) return;

    const message = reply.trim();

    if (!message && !status) {
      return;
    }

    try {
      setSaving(Boolean(message));
      setStatusSaving(Boolean(status));
      setError("");

      const response = await fetch(
        `/api/admin/support/tickets/${encodeURIComponent(selectedTicket.id)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adminUserId,
            message: message || undefined,
            status: status || undefined,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر تحديث التذكرة.",
        );
      }

      setSelectedTicket(data.ticket);
      setReply("");
      await loadTickets(filter);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "تعذر تحديث التذكرة.",
      );
    } finally {
      setSaving(false);
      setStatusSaving(false);
    }
  }

  if (authorized === null || loading && authorized) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={30} />
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <CircleAlert className="mx-auto text-red-500" size={42} />
          <h1 className="mt-4 text-2xl font-black">غير مصرح</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            لازم تكون داخل حساب المدير حتى تفتح مركز تذاكر الدعم.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-flex rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white"
          >
            العودة إلى لوحة التحكم
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <a
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600"
            >
              <ArrowRight size={16} />
              لوحة الإدارة
            </a>

            <p className="mt-4 text-sm font-bold text-blue-600">
              مركز الدعم
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              تذاكر الدعم
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              تابع مشاكل العملاء ورد عليهم من مكان واحد، مع حالة واضحة لكل تذكرة.
            </p>
          </div>

          <button
            onClick={() => loadTickets(filter)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            تحديث
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <CircleAlert size={19} />
            <p>{error}</p>
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">كل التذاكر</p>
                <p className="mt-2 text-3xl font-black">{counts.all}</p>
              </div>
              <MessageCircle className="text-blue-600" size={25} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">مفتوحة</p>
                <p className="mt-2 text-3xl font-black">{counts.open}</p>
              </div>
              <CircleAlert className="text-emerald-600" size={25} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">قيد المعالجة</p>
                <p className="mt-2 text-3xl font-black">{counts.inProgress}</p>
              </div>
              <Clock3 className="text-amber-600" size={25} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">مغلقة</p>
                <p className="mt-2 text-3xl font-black">{counts.closed}</p>
              </div>
              <CheckCircle2 className="text-slate-500" size={25} />
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              ["ALL", "الكل"],
              ["OPEN", "مفتوحة"],
              ["IN_PROGRESS", "قيد المعالجة"],
              ["CLOSED", "مغلقة"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setFilter(value);
                void loadTickets(value);
              }}
              className={`rounded-2xl border px-4 py-2.5 text-xs font-black transition ${
                filter === value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-5">
          {tickets.length === 0 && !loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Headphones className="mx-auto text-slate-300" size={42} />
              <h2 className="mt-4 text-xl font-black">
                ماكو تذاكر بهذا الفلتر
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                أي تذكرة جديدة من التطبيق راح تظهر هنا مباشرة.
              </p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => void openTicket(ticket.id)}
                className="rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClasses(ticket.status)}`}
                      >
                        {statusLabel(ticket.status)}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">
                        {categoryLabel(ticket.category)}
                      </span>
                    </div>

                    <h2 className="mt-3 truncate text-lg font-black">
                      {ticket.subject}
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      {ticket.id}
                    </p>

                    <p className="mt-4 line-clamp-2 text-sm leading-7 text-slate-500">
                      {ticket.messages.at(-1)?.message || "لا توجد رسائل."}
                    </p>
                  </div>

                  <div className="w-full shrink-0 rounded-2xl bg-slate-50 p-4 lg:w-72">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <UserRound size={19} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {ticket.userName}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {ticket.userPhone}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{ticket.messages.length} رسائل</span>
                      <span>{formatDate(ticket.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:p-6">
          <div className="mx-auto flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[32px] bg-white shadow-2xl sm:rounded-[32px]">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClasses(selectedTicket.status)}`}
                    >
                      {statusLabel(selectedTicket.status)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedTicket.id}
                    </span>
                  </div>

                  <h2 className="mt-2 truncate text-xl font-black">
                    {selectedTicket.subject}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedTicket.userName} • {selectedTicket.userPhone}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_280px]">
              <div className="flex min-h-0 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5 sm:p-7">
                  {selectedTicket.messages.map((message) => {
                    const adminMessage = message.sender === "ADMIN";

                    return (
                      <div
                        key={message.id}
                        className={`flex ${adminMessage ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-3xl px-4 py-3 ${
                            adminMessage
                              ? "border border-slate-200 bg-white"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          <p
                            className={`text-[10px] font-black ${
                              adminMessage
                                ? "text-blue-600"
                                : "text-blue-100"
                            }`}
                          >
                            {adminMessage
                              ? "فريق شاشتنا"
                              : message.senderName || selectedTicket.userName}
                          </p>

                          <p
                            className={`mt-1 whitespace-pre-wrap text-sm leading-7 ${
                              adminMessage
                                ? "text-slate-700"
                                : "text-white"
                            }`}
                          >
                            {message.message}
                          </p>

                          <p
                            className={`mt-2 text-[9px] ${
                              adminMessage
                                ? "text-slate-400"
                                : "text-blue-100"
                            }`}
                          >
                            {formatDate(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="اكتب رد فريق شاشتنا..."
                    className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                    disabled={saving || statusSaving}
                  />

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      onClick={() => updateTicket("CLOSED")}
                      disabled={saving || statusSaving || selectedTicket.status === "CLOSED"}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
                    >
                      {statusSaving ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      إغلاق التذكرة
                    </button>

                    <button
                      onClick={() => void updateTicket()}
                      disabled={saving || statusSaving || !reply.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      إرسال الرد
                    </button>
                  </div>
                </div>
              </div>

              <aside className="hidden border-r border-slate-200 bg-white p-5 lg:block">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-xs font-bold text-slate-400">بيانات العميل</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                      <UserRound size={21} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {selectedTicket.userName}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {selectedTicket.userPhone}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">النوع</span>
                      <span className="font-bold text-slate-700">
                        {categoryLabel(selectedTicket.category)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">الرسائل</span>
                      <span className="font-bold text-slate-700">
                        {selectedTicket.messages.length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">آخر تحديث</span>
                      <span className="font-bold text-slate-700">
                        {formatDate(selectedTicket.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-5">
                  <p className="text-xs font-black text-blue-700">
                    حالة التذكرة
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ["OPEN", "مفتوحة"],
                        ["IN_PROGRESS", "قيد المعالجة"],
                        ["CLOSED", "مغلقة"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => void updateTicket(value)}
                        disabled={statusSaving}
                        className={`rounded-xl border px-3 py-2 text-[10px] font-black transition ${
                          selectedTicket.status === value
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-blue-100 bg-white text-blue-700"
                        } disabled:opacity-50`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
