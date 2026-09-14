"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Smartphone,
  ChevronLeft,
  RefreshCcw,
  Send,
  MessageCircle,
  Copy,
  Check,
  LoaderCircle,
  CircleAlert,
} from "lucide-react";

import { useLanguage } from "../components/LanguageProvider";

type UserData = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
};

type Device = {
  id: number;
  name: string;
  slug: string;
  serviceType: string;
  price: number;
  description: string;
  specifications: string;
  notes?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
};

type ContactMethod =
  | "TELEGRAM"
  | "FACEBOOK";

const TELEGRAM_URL =
  "https://t.me/shashtna";

const FACEBOOK_MESSENGER_URL =
  "https://www.facebook.com/profile.php?id=61594341596034";

export default function DevicesPage() {
  const { language } = useLanguage();

  const isArabic = language === "ar";

  const [devices, setDevices] =
    useState<Device[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [user, setUser] =
    useState<UserData | null>(null);

  const [selectedDevice, setSelectedDevice] =
    useState<Device | null>(null);

  const [selectedContact, setSelectedContact] =
    useState<ContactMethod | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [requestId, setRequestId] =
    useState<number | null>(null);

  const [copied, setCopied] =
    useState(false);

  useEffect(() => {
    try {
      const storedUser =
        localStorage.getItem("user");

      if (storedUser) {
        setUser(
          JSON.parse(storedUser)
        );
      }
    } catch {
      localStorage.removeItem("user");
      setUser(null);
    }
  }, []);

  async function loadDevices() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/devices",
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
            "تعذر تحميل الأجهزة"
        );
      }

      setDevices(
        Array.isArray(
          data.devices
        )
          ? data.devices.filter(
              (device: Device) =>
                device.isActive
            )
          : []
      );
    } catch (error) {
      console.error(
        "Devices page error:",
        error
      );

      setError(
        isArabic
          ? "تعذر تحميل الأجهزة حاليًا."
          : "Unable to load devices right now."
      );

      setDevices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
  }, []);

  function formatPrice(price: number) {
    return new Intl.NumberFormat(
      "en-US"
    ).format(price);
  }

  function getServiceLabel(
    serviceType: string
  ) {
    return serviceType?.toUpperCase() ===
      "VIP"
      ? "VIP"
      : "IPTV";
  }

  function openPurchase(
    device: Device
  ) {
    setSelectedDevice(device);
    setSelectedContact(null);
    setRequestId(null);
    setCopied(false);
  }

  function closePurchase() {
    if (saving) {
      return;
    }

    setSelectedDevice(null);
    setSelectedContact(null);
    setRequestId(null);
    setCopied(false);
  }

  const purchaseMessage =
    selectedDevice && user
      ? isArabic
        ? `السلام عليكم، أريد شراء جهاز عن طريق موقع شاشتنا.

بيانات المشترك:
الاسم: ${user.name}
رقم الهاتف: ${user.phone}
البريد الإلكتروني: ${user.email}

الجهاز: ${selectedDevice.name}
نوع الخدمة: ${getServiceLabel(selectedDevice.serviceType)}
السعر: ${selectedDevice.price.toLocaleString("en-US")} دينار
معرف الجهاز: ${selectedDevice.id}

أرجو إكمال إجراءات الطلب.`
        : `Hello, I would like to purchase a device through the Shashtna website.

Subscriber details:
Name: ${user.name}
Phone: ${user.phone}
Email: ${user.email}

Device: ${selectedDevice.name}
Service type: ${getServiceLabel(selectedDevice.serviceType)}
Price: ${selectedDevice.price.toLocaleString("en-US")} IQD
Device ID: ${selectedDevice.id}

Please complete the order process.`
      : "";

  async function createPurchaseRequest(
    method: ContactMethod
  ) {
    if (
      !selectedDevice ||
      !user
    ) {
      return null;
    }

    setSaving(true);
    setSelectedContact(method);
    setError("");

    try {
      const response =
        await fetch(
          "/api/subscription-requests",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              userId: user.id,
              planSlug:
                `device:${selectedDevice.slug}`,
              serviceType: "DEVICE",
              contactMethod: method,
              requestType:
                "DEVICE_PURCHASE",
              deviceId:
                String(
                  selectedDevice.id
                ),
              deviceName:
                selectedDevice.name,
              devicePrice:
                selectedDevice.price,
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
          data.error ||
            "تعذر حفظ طلب شراء الجهاز."
        );
      }

      const newRequestId =
        typeof data.requestId ===
        "number"
          ? data.requestId
          : null;

      setRequestId(
        newRequestId
      );

      return newRequestId;
    } catch (error) {
      console.error(
        "Create device purchase request error:",
        error
      );

      setError(
        isArabic
          ? "تعذر حفظ طلب شراء الجهاز حاليًا."
          : "We could not save the device purchase request."
      );

      return null;
    } finally {
      setSaving(false);
    }
  }

  async function copyPurchaseMessage() {
    if (!purchaseMessage) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        purchaseMessage
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        2200
      );
    } catch (error) {
      console.error(
        "Copy device purchase message error:",
        error
      );
    }
  }

  async function buyViaTelegram() {
    if (!selectedDevice) {
      return;
    }

    if (!user) {
      window.location.href =
        `/login?redirect=${encodeURIComponent(
          "/devices"
        )}`;

      return;
    }

    const created =
      await createPurchaseRequest(
        "TELEGRAM"
      );

    if (
      created === null
    ) {
      return;
    }

    const url =
      `${TELEGRAM_URL}?text=` +
      encodeURIComponent(
        purchaseMessage
      );

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function buyViaFacebook() {
    if (!selectedDevice) {
      return;
    }

    if (!user) {
      window.location.href =
        `/login?redirect=${encodeURIComponent(
          "/devices"
        )}`;

      return;
    }

    const created =
      await createPurchaseRequest(
        "FACEBOOK"
      );

    if (
      created === null
    ) {
      return;
    }

    await copyPurchaseMessage();

    window.open(
      FACEBOOK_MESSENGER_URL,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <>
      <main
        dir={
          isArabic
            ? "rtl"
            : "ltr"
        }
        className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#070b14] dark:text-white"
      >
        <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <Smartphone size={15} />

                {isArabic
                  ? "الأجهزة المتوفرة"
                  : "Available devices"}
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                {isArabic
                  ? "الأجهزة"
                  : "Devices"}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                {isArabic
                  ? "اختار الجهاز المناسب وشوف تفاصيله وسعره، وتكدر تطلبه مباشرة."
                  : "Choose the right device, view its details and price, and order it directly."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  void loadDevices();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/30 dark:hover:text-blue-400"
              >
                <RefreshCcw size={17} />

                {isArabic
                  ? "تحديث"
                  : "Refresh"}
              </button>

              <Link
                href="/plans"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                {isArabic
                  ? "عرض الباقات"
                  : "View plans"}

                <ChevronLeft
                  size={17}
                  className={
                    isArabic
                      ? ""
                      : "rotate-180"
                  }
                />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                1,
                2,
                3,
                4,
                5,
                6,
              ].map(
                (item) => (
                  <div
                    key={item}
                    className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800" />

                    <div className="space-y-4 p-6">
                      <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

                      <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

                      <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

                      <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                )
              )}
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <RefreshCcw size={26} />
              </div>

              <h2 className="mt-5 text-xl font-black text-red-700 dark:text-red-300">
                {error}
              </h2>

              <button
                type="button"
                onClick={() => {
                  void loadDevices();
                }}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-red-700"
              >
                <RefreshCcw size={17} />

                {isArabic
                  ? "إعادة المحاولة"
                  : "Try again"}
              </button>
            </div>
          ) : devices.length ===
            0 ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Smartphone size={34} />
              </div>

              <h2 className="mt-6 text-2xl font-black">
                {isArabic
                  ? "ماكو أجهزة متوفرة حاليًا"
                  : "No devices available"}
              </h2>

              <p className="mx-auto mt-3 max-w-xl leading-8 text-slate-500 dark:text-slate-400">
                {isArabic
                  ? "حاليًا ماكو أجهزة فعالة مضافة للنظام."
                  : "There are no active devices available right now."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {devices.map(
                (device) => {
                  const serviceLabel =
                    getServiceLabel(
                      device.serviceType
                    );

                  return (
                    <article
                      key={
                        device.id
                      }
                      className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30"
                    >
                      <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <div className="absolute left-4 top-4 z-10">
                          <span
                            className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                              serviceLabel ===
                              "VIP"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            }`}
                          >
                            {
                              serviceLabel
                            }
                          </span>
                        </div>

                        {device.imageUrl ? (
                          <div className="flex h-64 items-center justify-center bg-white p-8 dark:bg-slate-950">
                            <img
                              src={
                                device.imageUrl
                              }
                              alt={
                                device.name
                              }
                              className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-105"
                            />
                          </div>
                        ) : (
                          <div className="flex h-64 items-center justify-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm dark:bg-slate-900 dark:text-slate-700">
                              <Smartphone
                                size={
                                  38
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-6">
                        <h2 className="text-xl font-black">
                          {
                            device.name
                          }
                        </h2>

                        <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                          {
                            device.description
                          }
                        </p>

                        <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                          <div className="text-xs font-black text-slate-500 dark:text-slate-400">
                            {isArabic
                              ? "المواصفات"
                              : "Specifications"}
                          </div>

                          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-200">
                            {device.specifications ||
                              (isArabic
                                ? "لا توجد مواصفات مضافة."
                                : "No specifications added.")}
                          </p>
                        </div>

                        {device.notes && (
                          <div className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                            <div className="text-xs font-black text-slate-500 dark:text-slate-400">
                              {isArabic
                                ? "ملاحظات"
                                : "Notes"}
                            </div>

                            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">
                              {
                                device.notes
                              }
                            </p>
                          </div>
                        )}

                        <div className="mt-6 flex items-end justify-between gap-4">
                          <div>
                            <div className="text-xs font-bold text-slate-400">
                              {isArabic
                                ? "السعر"
                                : "Price"}
                            </div>

                            <div className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">
                              {formatPrice(
                                device.price
                              )}{" "}
                              <span className="text-sm">
                                IQD
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openPurchase(
                              device
                            )
                          }
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                        >
                          <Smartphone
                            size={18}
                          />

                          {isArabic
                            ? "شراء الجهاز"
                            : "Buy device"}
                        </button>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </main>

      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="border-b border-slate-200 p-6 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {isArabic
                      ? "شراء جهاز"
                      : "DEVICE PURCHASE"}
                  </div>

                  <h2 className="mt-1 text-2xl font-black">
                    {
                      selectedDevice.name
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    closePurchase
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {!user ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/20 dark:bg-blue-500/[0.06]">
                  <div className="flex items-start gap-3">
                    <CircleAlert
                      size={18}
                      className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                    />

                    <div>
                      <p className="text-sm font-black text-blue-800 dark:text-blue-300">
                        {isArabic
                          ? "سجل دخولك أولًا حتى نكدر نحفظ طلب الشراء بحسابك."
                          : "Please sign in first so we can save your purchase request to your account."}
                      </p>

                      <Link
                        href={`/login?redirect=${encodeURIComponent(
                          "/devices"
                        )}`}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
                      >
                        {isArabic
                          ? "تسجيل الدخول"
                          : "Sign in"}

                        <ChevronLeft
                          size={16}
                          className={
                            isArabic
                              ? ""
                              : "rotate-180"
                          }
                        />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-400">
                          {isArabic
                            ? "الجهاز"
                            : "Device"}
                        </div>

                        <div className="mt-1 text-lg font-black">
                          {
                            selectedDevice.name
                          }
                        </div>
                      </div>

                      <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                        {formatPrice(
                          selectedDevice.price
                        )}{" "}
                        IQD
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-black text-slate-400">
                        {isArabic
                          ? "الرسالة الجاهزة"
                          : "READY MESSAGE"}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          void copyPurchaseMessage();
                        }}
                        disabled={
                          !purchaseMessage
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {copied ? (
                          <>
                            <Check
                              size={14}
                            />

                            {isArabic
                              ? "تم النسخ"
                              : "Copied"}
                          </>
                        ) : (
                          <>
                            <Copy
                              size={14}
                            />

                            {isArabic
                              ? "نسخ"
                              : "Copy"}
                          </>
                        )}
                      </button>
                    </div>

                    <div className="whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      {
                        purchaseMessage
                      }
                    </div>
                  </div>

                  {requestId && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06] dark:text-emerald-300">
                      {isArabic
                        ? `تم حفظ طلب الشراء #${requestId}`
                        : `Purchase request #${requestId} saved`}
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-300">
                      {error}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        void buyViaTelegram();
                      }}
                      disabled={
                        saving
                      }
                      className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving &&
                      selectedContact ===
                        "TELEGRAM" ? (
                        <LoaderCircle
                          size={18}
                          className="animate-spin"
                        />
                      ) : (
                        <Send size={18} />
                      )}

                      {isArabic
                        ? "الشراء عبر Telegram"
                        : "Buy via Telegram"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void buyViaFacebook();
                      }}
                      disabled={
                        saving
                      }
                      className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving &&
                      selectedContact ===
                        "FACEBOOK" ? (
                        <LoaderCircle
                          size={18}
                          className="animate-spin"
                        />
                      ) : (
                        <MessageCircle
                          size={18}
                        />
                      )}

                      {isArabic
                        ? "الشراء عبر Facebook"
                        : "Buy via Facebook"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}