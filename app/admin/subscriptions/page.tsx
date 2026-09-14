"use client";

import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleX,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Search,
  Tv,
  UserRound,
  Wifi,
  X,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Subscription = {
  id: number;
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceType: string;
  username: string;
  password: string;
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

type EditForm = {
  packageName: string;
  username: string;
  password: string;
  macAddress: string;
  deviceId: string;
  startDate: string;
  expiryDate: string;
  status: string;
  maxConnections: string;
};

function normalizeDateOnly(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const stringValue =
    String(value).trim();

  if (!stringValue) {
    return "";
  }

  const match =
    stringValue.match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  if (match?.[1]) {
    return match[1];
  }

  const parsed =
    new Date(stringValue);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  const year =
    parsed.getFullYear();

  const month =
    String(
      parsed.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      parsed.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(
  value: string
) {
  const normalized =
    normalizeDateOnly(value);

  if (!normalized) {
    return "—";
  }

  const date =
    new Date(
      `${normalized}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "ar-IQ",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "ar-IQ",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function addYearsToDate(
  value: string,
  years: number
) {
  const normalized =
    normalizeDateOnly(value);

  if (!normalized) {
    return "";
  }

  const date =
    new Date(
      `${normalized}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  date.setFullYear(
    date.getFullYear() +
      years
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getInitialEditForm(
  subscription: Subscription
): EditForm {
  return {
    packageName:
      subscription.packageName ??
      "",

    username:
      subscription.username ??
      "",

    password:
      subscription.password ??
      "",

    macAddress:
      subscription.macAddress ??
      "",

    deviceId:
      subscription.deviceId ??
      "",

    startDate:
      normalizeDateOnly(
        subscription.startDate
      ),

    expiryDate:
      normalizeDateOnly(
        subscription.expiryDate
      ),

    status:
      subscription.status
        ?.toUpperCase() ??
      "ACTIVE",

    maxConnections:
      String(
        subscription.maxConnections ??
          1
      ),
  };
}

export default function AdminSubscriptionsPage() {
  const [
    subscriptions,
    setSubscriptions,
  ] = useState<
    Subscription[]
  >([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    editingSubscription,
    setEditingSubscription,
  ] =
    useState<Subscription | null>(
      null
    );

  const [
    editForm,
    setEditForm,
  ] = useState<EditForm>({
    packageName: "",
    username: "",
    password: "",
    macAddress: "",
    deviceId: "",
    startDate: "",
    expiryDate: "",
    status: "ACTIVE",
    maxConnections: "1",
  });

  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);

  const [
    editError,
    setEditError,
  ] = useState("");

  const [
    editSuccess,
    setEditSuccess,
  ] = useState("");

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/admin/subscriptions",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "تعذر جلب الاشتراكات"
        );
      }

      setSubscriptions(
        data.subscriptions ?? []
      );
    } catch (error) {
      console.error(
        "Admin subscriptions error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء جلب الاشتراكات"
      );
    } finally {
      setLoading(false);
    }
  }

  function openEdit(
    subscription: Subscription
  ) {
    setEditingSubscription(
      subscription
    );

    setEditForm(
      getInitialEditForm(
        subscription
      )
    );

    setEditError("");
    setEditSuccess("");
  }

  function closeEdit() {
    if (savingEdit) {
      return;
    }

    setEditingSubscription(
      null
    );

    setEditError("");
    setEditSuccess("");
  }

  function updateEditField(
    field: keyof EditForm,
    value: string
  ) {
    setEditForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function addOneYear() {
    const updatedExpiry =
      addYearsToDate(
        editForm.expiryDate,
        1
      );

    if (!updatedExpiry) {
      setEditError(
        "تاريخ الانتهاء الحالي غير صحيح."
      );
      return;
    }

    setEditForm(
      (current) => ({
        ...current,
        expiryDate:
          updatedExpiry,
      })
    );

    setEditError("");
  }

  async function saveEdit() {
    if (
      !editingSubscription
    ) {
      return;
    }

    if (
      !editForm.startDate ||
      !editForm.expiryDate
    ) {
      setEditError(
        "يرجى إدخال تاريخ البداية والانتهاء."
      );
      return;
    }

    if (
      editForm.expiryDate <
      editForm.startDate
    ) {
      setEditError(
        "تاريخ الانتهاء لا يمكن أن يكون قبل تاريخ البداية."
      );
      return;
    }

    const maxConnections =
      Number(
        editForm.maxConnections
      );

    if (
      !Number.isInteger(
        maxConnections
      ) ||
      maxConnections < 1 ||
      maxConnections > 100
    ) {
      setEditError(
        "الحد الأقصى للاتصالات يجب أن يكون بين 1 و100."
      );
      return;
    }

    const serviceType =
      String(
        editingSubscription.serviceType ??
          "IPTV"
      )
        .trim()
        .toUpperCase();

    if (
      serviceType === "IPTV" &&
      (!editForm.username.trim() ||
        !editForm.password.trim())
    ) {
      setEditError(
        "اشتراك IPTV يحتاج Username و Password."
      );
      return;
    }

    if (
      serviceType === "VIP" &&
      !editForm.deviceId.trim()
    ) {
      setEditError(
        "اشتراك VIP يحتاج Device ID أو Serial Number."
      );
      return;
    }

    try {
      setSavingEdit(true);
      setEditError("");
      setEditSuccess("");

      const response =
        await fetch(
          "/api/admin/subscriptions",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              subscriptionId:
                editingSubscription.id,

              packageName:
                editForm.packageName.trim(),

              username:
                editForm.username.trim(),

              password:
                editForm.password.trim(),

              macAddress:
                editForm.macAddress.trim(),

              deviceId:
                editForm.deviceId.trim(),

              startDate:
                editForm.startDate,

              expiryDate:
                editForm.expiryDate,

              status:
                editForm.status,

              maxConnections,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "تعذر تعديل الاشتراك."
        );
      }

      setSubscriptions(
        (current) =>
          current.map(
            (subscription) =>
              subscription.id ===
              editingSubscription.id
                ? {
                    ...subscription,
                    ...data.subscription,
                  }
                : subscription
          )
      );

      setEditingSubscription(
        (current) =>
          current
            ? {
                ...current,
                ...data.subscription,
              }
            : current
      );

      setEditSuccess(
        "تم تعديل الاشتراك بنجاح."
      );

      setTimeout(
        () => {
          setEditingSubscription(
            null
          );
          setEditSuccess("");
        },
        900
      );
    } catch (error) {
      console.error(
        "Edit subscription error:",
        error
      );

      setEditError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تعديل الاشتراك."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  const filteredSubscriptions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return subscriptions;
      }

      return subscriptions.filter(
        (subscription) => {
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
        }
      );
    }, [
      subscriptions,
      search,
    ]);

  const activeCount =
    subscriptions.filter(
      (item) => {
        const status =
          item.status.toUpperCase();

        const expiry =
          normalizeDateOnly(
            item.expiryDate
          );

        const today =
          normalizeDateOnly(
            new Date()
          );

        return (
          status ===
            "ACTIVE" &&
          expiry &&
          expiry >= today
        );
      }
    ).length;

  const expiredCount =
    subscriptions.filter(
      (item) => {
        const expiry =
          normalizeDateOnly(
            item.expiryDate
          );

        const today =
          normalizeDateOnly(
            new Date()
          );

        return (
          item.status.toUpperCase() ===
            "EXPIRED" ||
          (expiry &&
            expiry <
              today)
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
              onClick={() => {
                void loadSubscriptions();
              }}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-blue-400"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
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
            value={
              subscriptions.length
            }
            icon={
              <Tv size={21} />
            }
          />

          <StatCard
            title="النشطة"
            value={
              activeCount
            }
            icon={
              <CircleCheck
                size={21}
              />
            }
          />

          <StatCard
            title="المنتهية"
            value={
              expiredCount
            }
            icon={
              <CircleX
                size={21}
              />
            }
          />

          <StatCard
            title="أخرى"
            value={
              otherCount
            }
            icon={
              <Wifi size={21} />
            }
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
                setSearch(
                  event.target.value
                )
              }
              placeholder="ابحث بالعميل أو Username أو MAC أو الباقة..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-12 text-right text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-right">
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

                  <th className="px-5 py-4 text-xs font-black text-slate-500 dark:text-slate-400">
                    إدارة
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <LoadingRows />
                ) : filteredSubscriptions.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={7}
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
                    (
                      subscription
                    ) => (
                      <SubscriptionRow
                        key={
                          subscription.id
                        }
                        subscription={
                          subscription
                        }
                        onEdit={() =>
                          openEdit(
                            subscription
                          )
                        }
                      />
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {!loading &&
            filteredSubscriptions.length >
              0 && (
              <div className="border-t border-slate-200 px-6 py-4 text-xs font-semibold text-slate-400 dark:border-slate-800">
                عرض{" "}
                {
                  filteredSubscriptions.length
                }{" "}
                من أصل{" "}
                {
                  subscriptions.length
                }{" "}
                اشتراك
              </div>
            )}
        </div>
      </div>

      {editingSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <div className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400">
                  <Edit3
                    size={16}
                  />
                  تعديل الاشتراك
                </div>

                <h2 className="mt-1 text-xl font-black">
                  {
                    editingSubscription.customerName
                  }{" "}
                  • الاشتراك #
                  {
                    editingSubscription.id
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeEdit
                }
                disabled={
                  savingEdit
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {editError && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  <CircleAlert
                    size={18}
                  />
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <CircleCheck
                    size={18}
                  />
                  {editSuccess}
                </div>
              )}

              <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 dark:border-blue-900/30 dark:bg-blue-950/20">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-500 dark:text-blue-400">
                      العميل
                    </div>

                    <div className="mt-1 font-black text-blue-900 dark:text-blue-100">
                      {
                        editingSubscription.customerName
                      }
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-500 dark:text-blue-400">
                      الخدمة
                    </div>

                    <div className="mt-1 font-black text-blue-900 dark:text-blue-100">
                      {
                        editingSubscription.serviceType
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <EditInput
                  label="اسم الباقة"
                  value={
                    editForm.packageName
                  }
                  onChange={(value) =>
                    updateEditField(
                      "packageName",
                      value
                    )
                  }
                />

                <EditInput
                  label="Username"
                  value={
                    editForm.username
                  }
                  onChange={(value) =>
                    updateEditField(
                      "username",
                      value
                    )
                  }
                />

                <EditInput
                  label="Password"
                  value={
                    editForm.password
                  }
                  onChange={(value) =>
                    updateEditField(
                      "password",
                      value
                    )
                  }
                />

                <EditInput
                  label="MAC Address"
                  value={
                    editForm.macAddress
                  }
                  onChange={(value) =>
                    updateEditField(
                      "macAddress",
                      value
                    )
                  }
                />

                <EditInput
                  label="Device ID / Serial Number"
                  value={
                    editForm.deviceId
                  }
                  onChange={(value) =>
                    updateEditField(
                      "deviceId",
                      value
                    )
                  }
                />

                <div>
                  <label className="mb-2 block text-sm font-black">
                    الحالة
                  </label>

                  <select
                    value={
                      editForm.status
                    }
                    onChange={(
                      event
                    ) =>
                      updateEditField(
                        "status",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
                  >
                    <option value="ACTIVE">
                      ACTIVE
                    </option>

                    <option value="EXPIRED">
                      EXPIRED
                    </option>

                    <option value="SUSPENDED">
                      SUSPENDED
                    </option>

                    <option value="CANCELLED">
                      CANCELLED
                    </option>
                  </select>
                </div>

                <EditInput
                  label="تاريخ البداية"
                  type="date"
                  value={
                    editForm.startDate
                  }
                  onChange={(value) =>
                    updateEditField(
                      "startDate",
                      value
                    )
                  }
                />

                <div>
                  <label className="mb-2 block text-sm font-black">
                    تاريخ الانتهاء
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={
                        editForm.expiryDate
                      }
                      onChange={(event) =>
                        updateEditField(
                          "expiryDate",
                          event.target
                            .value
                        )
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-900 outline-none transition focus:border-emerald-400 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100"
                    />

                    <button
                      type="button"
                      onClick={
                        addOneYear
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                    >
                      <PlusCircle
                        size={16}
                      />
                      + سنة
                    </button>
                  </div>

                  <p className="mt-2 text-[11px] font-bold leading-5 text-slate-400">
                    زر + سنة يضيف سنة كاملة إلى تاريخ الانتهاء الحالي.
                  </p>
                </div>

                <EditInput
                  label="الحد الأقصى للاتصالات"
                  type="number"
                  min="1"
                  max="100"
                  value={
                    editForm.maxConnections
                  }
                  onChange={(value) =>
                    updateEditField(
                      "maxConnections",
                      value
                    )
                  }
                />
              </div>

              <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/40">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      الانتهاء الحالي
                    </div>

                    <div className="mt-1 text-sm font-black">
                      {
                        formatDate(
                          editingSubscription.expiryDate
                        )
                      }
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      الانتهاء الجديد
                    </div>

                    <div className="mt-1 text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {
                        editForm.expiryDate
                          ? formatDate(
                              editForm.expiryDate
                            )
                          : "—"
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    void saveEdit();
                  }}
                  disabled={
                    savingEdit
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CircleCheck
                        size={18}
                      />
                      حفظ التعديلات
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={
                    closeEdit
                  }
                  disabled={
                    savingEdit
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function EditInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black">
        {label}
      </label>

      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
      />
    </div>
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
  onEdit,
}: {
  subscription: Subscription;
  onEdit: () => void;
}) {
  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const expiry =
    normalizeDateOnly(
      subscription.expiryDate
    );

  const today =
    normalizeDateOnly(
      new Date()
    );

  const expiredByDate =
    Boolean(expiry) &&
    expiry < today;

  const status =
    expiredByDate
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
              {
                subscription.customerName
              }
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {
                subscription.customerPhone
              }
            </div>

            <div className="mt-1 text-xs text-slate-400">
              {subscription.customerEmail}
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
              {
                subscription.username
              }
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
                setShowPassword(
                  (value) =>
                    !value
                )
              }
              className="text-slate-400 transition hover:text-blue-600"
              title={
                showPassword
                  ? "إخفاء كلمة المرور"
                  : "إظهار كلمة المرور"
              }
            >
              {showPassword ? (
                <EyeOff
                  size={15}
                />
              ) : (
                <Eye
                  size={15}
                />
              )}
            </button>
          </div>

          <div>
            <span className="font-bold text-slate-400">
              MAC:
            </span>{" "}
            <span className="font-black">
              {
                subscription.macAddress ||
                "—"
              }
            </span>
          </div>

          <div>
            <span className="font-bold text-slate-400">
              Device ID:
            </span>{" "}
            <span className="font-black">
              {
                subscription.deviceId ||
                "—"
              }
            </span>
          </div>
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <div className="font-black">
          {
            subscription.packageName
          }
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
            : status ===
                "EXPIRED"
              ? "منتهي"
              : status}
        </span>

        <div className="mt-2 text-xs text-slate-400">
          آخر تحديث:{" "}
          {formatDateTime(
            subscription.updatedAt
          )}
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <CalendarDays size={15} />

          {formatDate(
            subscription.startDate
          )}
        </div>

        <div className="mt-2 text-xs font-black text-slate-700 dark:text-slate-200">
          ينتهي:{" "}
          {formatDate(
            subscription.expiryDate
          )}
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400">
            <Wifi size={16} />
          </div>

          <div>
            <div className="text-sm font-black">
              {
                subscription.connections
              }{" "}
              /{" "}
              {
                subscription.maxConnections
              }
            </div>

            <div className="text-xs text-slate-400">
              اتصال
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-5 align-top">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
        >
          <Edit3 size={15} />
          تعديل
        </button>
      </td>
    </tr>
  );
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3, 4].map(
        (row) => (
          <tr key={row}>
            {Array.from(
              {
                length: 7,
              }
            ).map(
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
        )
      )}
    </>
  );
}