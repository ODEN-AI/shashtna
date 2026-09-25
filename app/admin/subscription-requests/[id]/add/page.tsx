"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  User,
  WalletCards,
  CalendarDays,
  Gift,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RequestData = {
  id: number;
  userId: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  planSlug: string;
  serviceName: string;
  serviceType: string;
  requestType?: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  bonusYears?: number;
  contactMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ExistingSubscription = {
  id: number;
  userId: number;
  serviceType: string;
  username: string | null;
  password: string | null;
  macAddress: string | null;
  deviceId: string | null;
  packageName: string;
  status: string;
  startDate: string;
  expiryDate: string;
};

const RENEWAL_YEAR_OPTIONS = [
  1,
  2,
  3,
  4,
  5,
];

const BONUS_YEAR_OPTIONS = [
  0,
  1,
  2,
  3,
  4,
  5,
];

function formatPrice(price: number) {
  return new Intl.NumberFormat(
    "en-US"
  ).format(price);
}

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

function formatDateOnly(
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

  return new Intl.DateTimeFormat(
    "ar-IQ",
    {
      dateStyle: "medium",
    }
  ).format(date);
}

function getTodayDate() {
  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      today.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateExpiry(
  startDate: string,
  months: number
) {
  const normalizedStart =
    normalizeDateOnly(
      startDate
    );

  if (
    !normalizedStart ||
    !Number.isInteger(months) ||
    months <= 0
  ) {
    return "";
  }

  const date =
    new Date(
      `${normalizedStart}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  date.setMonth(
    date.getMonth() + months
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

function getYearLabel(
  years: number
) {
  if (years === 1) {
    return "سنة واحدة";
  }

  if (years === 2) {
    return "سنتين";
  }

  return `${years} سنوات`;
}

function getBonusLabel(
  years: number
) {
  if (years === 0) {
    return "بدون بونص";
  }

  if (years === 1) {
    return "سنة واحدة بونص";
  }

  if (years === 2) {
    return "سنتين بونص";
  }

  return `${years} سنوات بونص`;
}

function getNewDurationLabel(
  baseLabel: string,
  bonusYears: number
) {
  if (
    !bonusYears
  ) {
    return baseLabel;
  }

  return `${baseLabel} + ${getBonusLabel(
    bonusYears
  )}`;
}

function normalizeStatus(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isDateBeforeToday(
  dateString: string
) {
  const normalized =
    normalizeDateOnly(
      dateString
    );

  if (!normalized) {
    return false;
  }

  return (
    normalized <
    getTodayDate()
  );
}

export default function AddSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [
    requestData,
    setRequestData,
  ] = useState<RequestData | null>(
    null
  );

  const [
    existingSubscription,
    setExistingSubscription,
  ] =
    useState<ExistingSubscription | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [macAddress, setMacAddress] =
    useState("");

  const [deviceId, setDeviceId] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [price, setPrice] =
    useState("");

  const [durationYears, setDurationYears] =
    useState(1);

  const [bonusYears, setBonusYears] =
    useState(0);

  useEffect(() => {
    // Access is enforced server-side by the admin layout and the APIs.

    async function load() {
      try {
        const routeParams =
          await params;

        const response =
          await fetch(
            `/api/admin/subscription-requests/${routeParams.id}`,
            {
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
              "تعذر تحميل الطلب."
          );
        }

        const request =
          data.request as RequestData;

        setRequestData(
          request
        );

        setPrice(
          String(
            request.price
          )
        );

        setStartDate(
          getTodayDate()
        );

        const requestType =
          normalizeStatus(
            request.requestType
          );

        if (
          requestType ===
          "RENEW"
        ) {
          setDurationYears(
            1
          );

          setBonusYears(
            0
          );

          const subscriptionsResponse =
            await fetch(
              "/api/admin/subscriptions",
              {
                cache:
                  "no-store",
              }
            );

          if (
            subscriptionsResponse.ok
          ) {
            const subscriptionsData =
              await subscriptionsResponse.json();

            if (
              subscriptionsData.success
            ) {
              const customerSubscriptions =
                (
                  subscriptionsData.subscriptions ??
                  []
                ) as ExistingSubscription[];

              const matched =
                customerSubscriptions
                  .filter(
                    (
                      subscription
                    ) =>
                      subscription.userId ===
                      request.userId
                  )
                  .sort(
                    (
                      a,
                      b
                    ) => {
                      const expiryA =
                        normalizeDateOnly(
                          a.expiryDate
                        );

                      const expiryB =
                        normalizeDateOnly(
                          b.expiryDate
                        );

                      return expiryB.localeCompare(
                        expiryA
                      );
                    }
                  )[0];

              if (matched) {
                setExistingSubscription(
                  matched
                );

                setUsername(
                  matched.username ??
                    ""
                );

                setPassword(
                  matched.password ??
                    ""
                );

                setMacAddress(
                  matched.macAddress ??
                    ""
                );

                setDeviceId(
                  matched.deviceId ??
                    ""
                );
              }
            }
          }
        } else {
          const originalYears =
            request.durationMonths /
            12;

          if (
            Number.isInteger(
              originalYears
            ) &&
            RENEWAL_YEAR_OPTIONS.includes(
              originalYears
            )
          ) {
            setDurationYears(
              originalYears
            );
          } else {
            setDurationYears(
              1
            );
          }

          setBonusYears(
            Number.isInteger(
              request.bonusYears
            ) &&
              (request.bonusYears ?? 0) >=
                0 &&
              (request.bonusYears ?? 0) <=
                5
              ? request.bonusYears ?? 0
              : 0
          );
        }
      } catch (error) {
        console.error(
          error
        );

        setError(
          "تعذر تحميل بيانات الطلب."
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    load();
  }, [params]);

  const requestType =
    normalizeStatus(
      requestData?.requestType
    );

  const isRenewal =
    requestType ===
    "RENEW";

  const baseDurationMonths =
    requestData?.durationMonths ??
    12;

  const selectedBonusMonths =
    isRenewal
      ? 0
      : bonusYears * 12;

  const finalDurationMonths =
    isRenewal
      ? durationYears * 12
      : baseDurationMonths +
        selectedBonusMonths;

  const finalDurationLabel =
    isRenewal
      ? `${getYearLabel(
          durationYears
        )}`
      : getNewDurationLabel(
          requestData?.durationLabel ??
            "1 Year",
          bonusYears
        );

  const normalizedExistingExpiry =
    existingSubscription
      ? normalizeDateOnly(
          existingSubscription.expiryDate
        )
      : "";

  const hasActiveExistingSubscription =
    isRenewal &&
    Boolean(
      normalizedExistingExpiry
    ) &&
    !isDateBeforeToday(
      normalizedExistingExpiry
    );

  const expiryBaseDate =
    isRenewal
      ? hasActiveExistingSubscription
        ? normalizedExistingExpiry
        : startDate
      : startDate;

  const expiryDate =
    useMemo(() => {
      return calculateExpiry(
        expiryBaseDate,
        finalDurationMonths
      );
    }, [
      expiryBaseDate,
      finalDurationMonths,
    ]);

  async function submitSubscription(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!requestData) {
      return;
    }

    if (
      !startDate ||
      !price
    ) {
      setError(
        "يرجى تعبئة جميع الحقول المطلوبة."
      );
      return;
    }

    if (
      isRenewal &&
      (!Number.isInteger(
        durationYears
      ) ||
        durationYears < 1 ||
        durationYears > 5)
    ) {
      setError(
        "مدة التجديد غير صحيحة."
      );
      return;
    }

    if (
      !isRenewal &&
      (!Number.isInteger(
        bonusYears
      ) ||
        bonusYears < 0 ||
        bonusYears > 5)
    ) {
      setError(
        "مدة البونص يجب أن تكون بين 0 و5 سنوات."
      );
      return;
    }

    const numericPrice =
      Number(price);

    if (
      !Number.isFinite(
        numericPrice
      ) ||
      numericPrice < 0
    ) {
      setError(
        "السعر غير صحيح."
      );
      return;
    }

    if (!isRenewal) {
      const serviceType =
        normalizeStatus(
          requestData.serviceType
        );

      if (
        serviceType ===
        "IPTV"
      ) {
        if (
          !username.trim() ||
          !password.trim()
        ) {
          setError(
            "اشتراك IPTV يحتاج Username و Password."
          );
          return;
        }
      }

      if (
        serviceType ===
        "VIP"
      ) {
        if (
          !deviceId.trim()
        ) {
          setError(
            "اشتراك VIP يحتاج Device ID أو Serial Number."
          );
          return;
        }
      }
    }

    try {
      setSaving(
        true
      );

      setError("");
      setSuccess("");

      const response =
        await fetch(
          "/api/admin/subscriptions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              requestId:
                requestData.id,

              userId:
                requestData.userId,

              serviceName:
                requestData.serviceName,

              serviceType:
                requestData.serviceType,

              username:
                username.trim(),

              password:
                password.trim(),

              macAddress:
                macAddress.trim(),

              deviceId:
                deviceId.trim(),

              startDate,

              price:
                numericPrice,

              durationMonths:
                finalDurationMonths,

              durationLabel:
                finalDurationLabel,

              bonusYears:
                isRenewal
                  ? 0
                  : bonusYears,
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
            "تعذر إنشاء الاشتراك."
        );
      }

      setSuccess(
        isRenewal
          ? `تم تجديد الاشتراك بنجاح لمدة ${getYearLabel(
              durationYears
            )}. رقم الاشتراك #${data.subscription.id}`
          : bonusYears > 0
            ? `تم إنشاء الاشتراك بنجاح مع ${getBonusLabel(
                bonusYears
              )}. المدة النهائية: ${finalDurationLabel}. رقم الاشتراك #${data.subscription.id}`
            : `تم إنشاء الاشتراك بنجاح. رقم الاشتراك #${data.subscription.id}`
      );

      window.setTimeout(
        () => {
          window.location.href =
            "/admin/subscription-requests";
        },
        900
      );
    } catch (error) {
      console.error(
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء معالجة الاشتراك."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            جاري تحميل بيانات الطلب...
          </p>
        </div>
      </main>
    );
  }

  if (!requestData) {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
          <h1 className="text-2xl font-black">
            تعذر العثور على الطلب
          </h1>

          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
            {error ||
              "الطلب غير موجود."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm dark:border-blue-900/40 dark:bg-slate-900/70 dark:text-blue-300">
              <CreditCard className="h-4 w-4" />

              {isRenewal
                ? "تجديد اشتراك"
                : "إضافة اشتراك"}
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {isRenewal
                ? `تجديد الطلب #${requestData.id}`
                : `قبول الطلب #${requestData.id}`}
            </h1>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isRenewal
                ? "حدد مدة التجديد التي تريد منحها للعميل ثم أكد العملية."
                : "أدخل بيانات الاشتراك الفعلية، ويمكنك إضافة مدة بونص مجانية للعميل."}
            </p>
          </div>

          <Link
            href="/admin/orders"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />

            رجوع للطلبات
          </Link>
        </div>

        <div className="mb-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm dark:border-blue-900/30 dark:bg-slate-900">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">
                العميل
              </p>

              <div className="mt-1 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />

                <h2 className="text-xl font-black">
                  {
                    requestData.customerName
                  }
                </h2>
              </div>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {requestData.customerPhone ||
                  "بدون هاتف"}{" "}
                •{" "}
                {requestData.customerEmail}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 px-5 py-4 dark:bg-blue-950/30">
              <p className="text-xs font-bold text-blue-500">
                الخدمة المطلوبة
              </p>

              <p className="mt-1 text-lg font-black text-blue-800 dark:text-blue-200">
                {
                  requestData.serviceName
                }
              </p>

              <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                {formatPrice(
                  requestData.price
                )}{" "}
                د.ع •{" "}
                {requestData.durationLabel}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />

            {success}
          </div>
        ) : null}

        <form
          onSubmit={
            submitSubscription
          }
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black">
                اسم المستخدم
              </label>

              <div className="relative">
                <KeyRound className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  value={
                    username
                  }
                  onChange={(
                    event
                  ) =>
                    setUsername(
                      event.target
                        .value
                    )
                  }
                  placeholder="مثال: STAR001"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                كلمة المرور
              </label>

              <div className="relative">
                <KeyRound className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  value={
                    password
                  }
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target
                        .value
                    )
                  }
                  placeholder="كلمة مرور الاشتراك"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                MAC Address
              </label>

              <div className="relative">
                <MonitorSmartphone className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  value={
                    macAddress
                  }
                  onChange={(
                    event
                  ) =>
                    setMacAddress(
                      event.target
                        .value
                    )
                  }
                  placeholder="00:11:22:33:44:55"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
                />
              </div>
            </div>

            {!isRenewal &&
            normalizeStatus(
              requestData.serviceType
            ) === "VIP" ? (
              <div>
                <label className="mb-2 block text-sm font-black">
                  Device ID / Serial Number
                </label>

                <div className="relative">
                  <MonitorSmartphone className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <input
                    value={
                      deviceId
                    }
                    onChange={(
                      event
                    ) =>
                      setDeviceId(
                        event.target
                          .value
                      )
                    }
                    placeholder="أدخل Device ID أو Serial Number"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-black">
                السعر
              </label>

              <div className="relative">
                <WalletCards className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  type="number"
                  min="0"
                  value={
                    price
                  }
                  onChange={(
                    event
                  ) =>
                    setPrice(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
                />
              </div>
            </div>

            {isRenewal ? (
              <div>
                <label className="mb-2 block text-sm font-black">
                  مدة التجديد
                </label>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <select
                    value={
                      durationYears
                    }
                    onChange={(
                      event
                    ) =>
                      setDurationYears(
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    className="w-full appearance-none rounded-2xl border border-blue-200 bg-blue-50 px-12 py-3.5 text-sm font-black text-blue-900 outline-none transition focus:border-blue-400 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100"
                  >
                    {RENEWAL_YEAR_OPTIONS.map(
                      (years) => (
                        <option
                          key={
                            years
                          }
                          value={
                            years
                          }
                        >
                          {getYearLabel(
                            years
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-black">
                  مدة البونص
                </label>

                <div className="relative">
                  <Gift className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <select
                    value={
                      bonusYears
                    }
                    onChange={(
                      event
                    ) =>
                      setBonusYears(
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    className="w-full appearance-none rounded-2xl border border-amber-200 bg-amber-50 px-12 py-3.5 text-sm font-black text-amber-900 outline-none transition focus:border-amber-400 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    {BONUS_YEAR_OPTIONS.map(
                      (years) => (
                        <option
                          key={
                            years
                          }
                          value={
                            years
                          }
                        >
                          {getBonusLabel(
                            years
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-black">
                تاريخ البداية
              </label>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(
                  event
                ) =>
                  setStartDate(
                    event.target
                      .value
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                تاريخ الانتهاء
              </label>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-black text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                {expiryDate
                  ? formatDateOnly(
                      expiryDate
                    )
                  : "سيتم حسابه تلقائياً"}
              </div>
            </div>
          </div>

          {!isRenewal &&
          bonusYears > 0 ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-7 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <Gift className="mt-1 h-5 w-5 shrink-0" />

              <div>
                <div>
                  تم إضافة{" "}
                  <strong>
                    {getBonusLabel(
                      bonusYears
                    )}
                  </strong>
                </div>

                <div>
                  المدة الأساسية:{" "}
                  <strong>
                    {
                      requestData.durationLabel
                    }
                  </strong>
                </div>

                <div>
                  المدة النهائية:{" "}
                  <strong>
                    {
                      finalDurationLabel
                    }
                  </strong>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-7 text-blue-900 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-200">
            <strong>
              ملاحظة:
            </strong>{" "}
            {isRenewal ? (
              <>
                سيتم منح العميل{" "}
                <strong>
                  {getYearLabel(
                    durationYears
                  )}
                </strong>
                ، أي{" "}
                <strong>
                  {
                    finalDurationMonths
                  }
                </strong>{" "}
                شهر.
                <br />

                {hasActiveExistingSubscription
                  ? `سيتم إضافة المدة إلى تاريخ انتهاء الاشتراك الحالي: ${formatDateOnly(
                      normalizedExistingExpiry
                    )}.`
                  : "الاشتراك الحالي منتهي، لذلك سيبدأ التجديد من تاريخ البداية المحدد أعلاه."}
              </>
            ) : (
              <>
                مدة الباقة الأساسية{" "}
                <strong>
                  {
                    requestData.durationLabel
                  }
                </strong>
                .
                <br />
                {bonusYears > 0
                  ? `تمت إضافة ${getBonusLabel(
                      bonusYears
                    )} مجانًا.`
                  : "ماكو بونص مضاف."}
                <br />
                المدة النهائية:{" "}
                <strong>
                  {
                    finalDurationLabel
                  }
                </strong>
                .
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={
              saving
            }
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />

                جاري معالجة الاشتراك...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />

                {isRenewal
                  ? "تأكيد التجديد"
                  : "تأكيد وإنشاء الاشتراك"}
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}