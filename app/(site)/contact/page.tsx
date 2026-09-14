"use client";

import Link from "next/link";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  CircleAlert,
  Clock3,
  Copy,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Tv,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLanguage } from "../components/LanguageProvider";

type UserData = {
  id: number;
  name: string;
  phone: string;
  role?: string;
};

type PackageData = {
  id: number;
  name: string;
  slug: string;
  serviceType: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

type DeviceData = {
  id: number;
  name: string;
  slug: string;
  serviceType: string;
  price: number;
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

type ContactMethod =
  | "TELEGRAM"
  | "FACEBOOK";

type VipRequestType =
  | "NEW"
  | "RENEW";

type StandardRequestType =
  | "NEW"
  | "RENEW";

const TELEGRAM_URL =
  "https://t.me/shashtna";

const FACEBOOK_MESSENGER_URL =
  "https://www.facebook.com/profile.php?id=61594341596034";

function normalizeServiceType(value: unknown) {
  return String(value ?? "IPTV")
    .trim()
    .toUpperCase();
}

function normalizeRequestType(
  value: unknown
): StandardRequestType | null {
  const normalized = String(
    value ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    normalized === "NEW" ||
    normalized === "RENEW"
  ) {
    return normalized;
  }

  return null;
}

function ContactPageContent() {
  const { language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const planSlug = searchParams.get("plan");

  const requestTypeParam =
    searchParams.get("requestType") ??
    searchParams.get("type");

  const renewParam =
    searchParams.get("renew");

  const initialRequestType =
    normalizeRequestType(
      requestTypeParam
    ) ??
    (renewParam === "1"
      ? "RENEW"
      : null);

  const [user, setUser] =
    useState<UserData | null>(null);

  const [selectedPackage, setSelectedPackage] =
    useState<PackageData | null>(null);

  const [mounted, setMounted] =
    useState(false);

  const [loadingPackage, setLoadingPackage] =
    useState(true);

  const [loadingDevices, setLoadingDevices] =
    useState(false);

  const [devices, setDevices] =
    useState<DeviceData[]>([]);

  const [selectedDevice, setSelectedDevice] =
    useState<DeviceData | null>(null);

  const [vipRequestType, setVipRequestType] =
    useState<VipRequestType | null>(
      initialRequestType
    );

  const [standardRequestType, setStandardRequestType] =
    useState<StandardRequestType | null>(
      initialRequestType
    );

  const [copied, setCopied] =
    useState(false);

  const [requestId, setRequestId] =
    useState<number | null>(null);

  const [savingRequest, setSavingRequest] =
    useState(false);

  const [selectedContact, setSelectedContact] =
    useState<ContactMethod | null>(null);

  const [requestError, setRequestError] =
    useState("");

  const isArabic = language === "ar";

  const isVip =
    normalizeServiceType(
      selectedPackage?.serviceType
    ) === "VIP";

  const activeRequestType =
    isVip
      ? vipRequestType
      : standardRequestType;

  const canContact =
    activeRequestType !== null &&
    (!isVip ||
      activeRequestType ===
        "RENEW" ||
      (activeRequestType ===
        "NEW" &&
        selectedDevice !== null));

  const currentPrice =
    isVip &&
    vipRequestType === "NEW" &&
    selectedDevice
      ? selectedPackage
        ? selectedPackage.price +
          selectedDevice.price
        : selectedDevice.price
      : selectedPackage?.price ?? 0;

  const message = useMemo(() => {
    if (!user || !selectedPackage) {
      return "";
    }

    const serviceName =
      selectedPackage.name;

    const duration =
      selectedPackage.durationLabel;

    const formattedPrice =
      currentPrice.toLocaleString(
        "en-US"
      );

    if (isVip) {
      if (
        vipRequestType ===
        "NEW"
      ) {
        return isArabic
          ? `السلام عليكم، أريد الاشتراك بباقة VIP جديدة عن طريق موقع شاشتنا.

بيانات المشترك:
الاسم: ${user.name}
رقم الهاتف: ${user.phone}

باقة VIP: ${serviceName}
المدة: ${duration}
سعر الباقة: ${selectedPackage.price.toLocaleString("en-US")} دينار
الجهاز: ${selectedDevice?.name ?? "لم يتم اختيار جهاز بعد"}
سعر الجهاز: ${selectedDevice?.price.toLocaleString("en-US") ?? "0"} دينار
الإجمالي: ${formattedPrice} دينار`
          : `Hello, I would like to subscribe to a new VIP plan through the Shashtna website.

Subscriber details:
Name: ${user.name}
Phone: ${user.phone}

VIP Plan: ${serviceName}
Duration: ${duration}
Plan Price: ${selectedPackage.price.toLocaleString("en-US")} IQD
Device: ${selectedDevice?.name ?? "No device selected yet"}
Device Price: ${selectedDevice?.price.toLocaleString("en-US") ?? "0"} IQD
Total: ${formattedPrice} IQD`;
      }

      if (
        vipRequestType ===
        "RENEW"
      ) {
        return isArabic
          ? `السلام عليكم، أريد تجديد اشتراك VIP عن طريق موقع شاشتنا.

بيانات المشترك:
الاسم: ${user.name}
رقم الهاتف: ${user.phone}

باقة VIP: ${serviceName}
السعر: ${selectedPackage.price.toLocaleString("en-US")} دينار`
          : `Hello, I would like to renew my VIP subscription through the Shashtna website.

Subscriber details:
Name: ${user.name}
Phone: ${user.phone}

VIP Plan: ${serviceName}
Price: ${selectedPackage.price.toLocaleString("en-US")} IQD`;
      }
    }

    if (
      standardRequestType ===
      "RENEW"
    ) {
      return isArabic
        ? `السلام عليكم، أريد تجديد اشتراكي بخدمة ${serviceName} عن طريق موقع شاشتنا.

بيانات المشترك:
الاسم: ${user.name}
رقم الهاتف: ${user.phone}

الباقة: ${serviceName}
السعر: ${selectedPackage.price.toLocaleString("en-US")} دينار`
        : `Hello, I would like to renew my ${serviceName} subscription through the Shashtna website.

Subscriber details:
Name: ${user.name}
Phone: ${user.phone}

Package: ${serviceName}
Price: ${selectedPackage.price.toLocaleString("en-US")} IQD`;
    }

    return isArabic
      ? `السلام عليكم، أريد الاشتراك بخدمة ${serviceName} لمدة ${duration} عن طريق موقع شاشتنا.

بيانات المشترك:
الاسم: ${user.name}
رقم الهاتف: ${user.phone}

الباقة: ${serviceName}
المدة: ${duration}
السعر: ${formattedPrice} دينار`
      : `Hello, I would like to subscribe to ${serviceName} for ${duration} through the Shashtna website.

Subscriber details:
Name: ${user.name}
Phone: ${user.phone}

Package: ${serviceName}
Duration: ${duration}
Price: ${formattedPrice} IQD`;
  }, [
    user,
    selectedPackage,
    selectedDevice,
    currentPrice,
    isVip,
    vipRequestType,
    standardRequestType,
    isArabic,
  ]);

  useEffect(() => {
    setMounted(true);

    try {
      const savedUser =
        localStorage.getItem(
          "user"
        );

      if (!savedUser) {
        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/contact?plan=${planSlug ?? ""}`
          )}`
        );

        return;
      }

      const parsedUser =
        JSON.parse(
          savedUser
        ) as UserData;

      if (
        !parsedUser ||
        !parsedUser.id ||
        !parsedUser.name ||
        !parsedUser.phone
      ) {
        localStorage.removeItem(
          "user"
        );

        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/contact?plan=${planSlug ?? ""}`
          )}`
        );

        return;
      }

      setUser(parsedUser);
    } catch {
      localStorage.removeItem(
        "user"
      );

      router.replace(
        `/login?redirect=${encodeURIComponent(
          `/contact?plan=${planSlug ?? ""}`
        )}`
      );
    }
  }, [
    router,
    planSlug,
  ]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!planSlug) {
      router.replace(
        "/plans"
      );
      return;
    }

    let cancelled = false;

    async function loadPackage() {
      setLoadingPackage(true);
      setRequestError("");

      try {
        const response =
          await fetch(
            "/api/packages",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as {
            success?: boolean;
            packages?: PackageData[];
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            "Failed to load packages."
          );
        }

        const packages =
          Array.isArray(
            data.packages
          )
            ? data.packages
            : [];

        const foundPackage =
          packages.find(
            (pkg) =>
              pkg.slug ===
                planSlug &&
              pkg.isActive
          ) ?? null;

        if (cancelled) {
          return;
        }

        if (!foundPackage) {
          router.replace(
            "/plans"
          );
          return;
        }

        setSelectedPackage(
          foundPackage
        );

        const serviceType =
          normalizeServiceType(
            foundPackage.serviceType
          );

        if (
          serviceType !==
          "VIP"
        ) {
          setVipRequestType(
            null
          );
          setDevices([]);
          setSelectedDevice(
            null
          );
        }
      } catch (error) {
        console.error(
          "Load selected package error:",
          error
        );

        if (!cancelled) {
          setRequestError(
            isArabic
              ? "تعذر تحميل الباقة المحددة حاليًا."
              : "We could not load the selected package."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPackage(
            false
          );
        }
      }
    }

    void loadPackage();

    return () => {
      cancelled = true;
    };
  }, [
    mounted,
    planSlug,
    router,
    isArabic,
  ]);

  useEffect(() => {
    if (!selectedPackage) {
      return;
    }

    const serviceType =
      normalizeServiceType(
        selectedPackage.serviceType
      );

    setRequestId(null);
    setSelectedContact(null);
    setRequestError("");

    if (serviceType === "VIP") {
      setStandardRequestType(
        null
      );
      setVipRequestType(
        initialRequestType
      );
      setDevices([]);
      setSelectedDevice(
        null
      );
      return;
    }

    setVipRequestType(null);
    setDevices([]);
    setSelectedDevice(null);
    setStandardRequestType(
      initialRequestType
    );
  }, [
    selectedPackage,
    initialRequestType,
  ]);

  useEffect(() => {
    if (
      !selectedPackage ||
      normalizeServiceType(
        selectedPackage.serviceType
      ) !== "VIP" ||
      vipRequestType !==
        "NEW" ||
      !planSlug
    ) {
      return;
    }

    let cancelled = false;

    async function loadVipDevices() {
      setLoadingDevices(
        true
      );
      setRequestError("");

      try {
        const query =
          `/api/devices?serviceType=VIP&packageSlug=${encodeURIComponent(
            planSlug ?? ""
          )}`;

        const response =
          await fetch(
            query,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as {
            success?: boolean;
            devices?: DeviceData[];
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            "Failed to load VIP devices."
          );
        }

        if (cancelled) {
          return;
        }

        const loadedDevices =
          Array.isArray(
            data.devices
          )
            ? data.devices.filter(
                (device) =>
                  device.isActive &&
                  normalizeServiceType(
                    device.serviceType
                  ) === "VIP"
              )
            : [];

        setDevices(
          loadedDevices
        );

        setSelectedDevice(
          (current) => {
            if (
              current &&
              loadedDevices.some(
                (device) =>
                  device.id ===
                  current.id
              )
            ) {
              return current;
            }

            return null;
          }
        );

        if (
          loadedDevices.length ===
          0
        ) {
          setRequestError(
            isArabic
              ? "ماكو أجهزة VIP مرتبطة بهذه الباقة حاليًا."
              : "There are no VIP devices linked to this plan yet."
          );
        }
      } catch (error) {
        console.error(
          "Load VIP devices error:",
          error
        );

        if (!cancelled) {
          setDevices([]);
          setSelectedDevice(
            null
          );

          setRequestError(
            isArabic
              ? "تعذر تحميل أجهزة VIP حاليًا."
              : "We could not load the VIP devices right now."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDevices(
            false
          );
        }
      }
    }

    void loadVipDevices();

    return () => {
      cancelled = true;
    };
  }, [
    selectedPackage,
    vipRequestType,
    planSlug,
    isArabic,
  ]);

  useEffect(() => {
    if (
      !user ||
      !selectedPackage ||
      !planSlug ||
      isVip ||
      !standardRequestType
    ) {
      return;
    }

    const currentUser =
      user;

    const currentPlanSlug =
      planSlug;

    const currentRequestType =
      standardRequestType;

    let cancelled = false;

    async function createRequest() {
      setSavingRequest(
        true
      );
      setRequestError("");

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
                userId:
                  currentUser.id,
                planSlug:
                  currentPlanSlug,
                serviceType:
                  "IPTV",
                contactMethod:
                  "PENDING",
                requestType:
                  currentRequestType,
              }),
            }
          );

        const data =
          (await response.json()) as {
            success?: boolean;
            requestId?: number;
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Failed to create request."
          );
        }

        if (!cancelled) {
          setRequestId(
            typeof data.requestId ===
              "number"
              ? data.requestId
              : null
          );
        }
      } catch (error) {
        console.error(
          "Create subscription request error:",
          error
        );

        if (!cancelled) {
          setRequestError(
            isArabic
              ? "تعذر حفظ طلبك حاليًا. تقدر تكمل التواصل ويانا."
              : "We could not save your request right now. You can still contact us."
          );
        }
      } finally {
        if (!cancelled) {
          setSavingRequest(
            false
          );
        }
      }
    }

    void createRequest();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    selectedPackage,
    planSlug,
    isVip,
    isArabic,
    standardRequestType,
  ]);

  async function createVipRequest(
    method: ContactMethod
  ) {
    if (
      !user ||
      !selectedPackage ||
      !planSlug ||
      !isVip ||
      !vipRequestType
    ) {
      return null;
    }

    if (
      vipRequestType ===
        "NEW" &&
      !selectedDevice
    ) {
      return null;
    }

    setSavingRequest(
      true
    );
    setRequestError("");

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
              userId:
                user.id,
              planSlug,
              serviceType:
                "VIP",
              contactMethod:
                method,
              requestType:
                vipRequestType,
              deviceId:
                vipRequestType ===
                "NEW"
                  ? String(
                      selectedDevice?.id ??
                        ""
                    )
                  : null,
              deviceName:
                vipRequestType ===
                "NEW"
                  ? selectedDevice?.name ??
                    null
                  : null,
              devicePrice:
                vipRequestType ===
                "NEW"
                  ? selectedDevice?.price ??
                    null
                  : null,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          requestId?: number;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to create VIP request."
        );
      }

      if (
        typeof data.requestId ===
        "number"
      ) {
        setRequestId(
          data.requestId
        );
      }

      return (
        data.requestId ??
        null
      );
    } catch (error) {
      console.error(
        "Create VIP request error:",
        error
      );

      setRequestError(
        isArabic
          ? "تعذر حفظ طلب VIP حاليًا. تقدر تكمل التواصل ويانا."
          : "We could not save your VIP request right now. You can still contact us."
      );

      return null;
    } finally {
      setSavingRequest(
        false
      );
    }
  }

  async function saveContactMethod(
    method: ContactMethod
  ) {
    if (
      !user ||
      !planSlug
    ) {
      return;
    }

    if (isVip) {
      if (
        !vipRequestType
      ) {
        return;
      }

      if (
        vipRequestType ===
          "NEW" &&
        !selectedDevice
      ) {
        return;
      }

      setSelectedContact(
        method
      );

      await createVipRequest(
        method
      );

      return;
    }

    if (!standardRequestType) {
      return;
    }

    setSelectedContact(
      method
    );

    setRequestError("");

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
              userId:
                user.id,
              planSlug,
              serviceType:
                "IPTV",
              contactMethod:
                method,
              requestType:
                standardRequestType,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          requestId?: number;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to update request."
        );
      }

      if (
        typeof data.requestId ===
        "number"
      ) {
        setRequestId(
          data.requestId
        );
      }
    } catch (error) {
      console.error(
        "Update subscription request error:",
        error
      );

      setRequestError(
        isArabic
          ? "تعذر تحديث طريقة التواصل."
          : "Could not update the contact method."
      );
    }
  }

  async function copyMessage() {
    if (!message) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        message
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
        "Copy message error:",
        error
      );

      setCopied(false);
    }
  }

  async function openTelegram() {
    if (
      !message ||
      !canContact
    ) {
      return;
    }

    await saveContactMethod(
      "TELEGRAM"
    );

    const url =
      `${TELEGRAM_URL}?text=` +
      encodeURIComponent(
        message
      );

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function openFacebook() {
    if (
      !canContact
    ) {
      return;
    }

    await saveContactMethod(
      "FACEBOOK"
    );

    window.open(
      FACEBOOK_MESSENGER_URL,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function chooseVipRequestType(
    type: VipRequestType
  ) {
    setVipRequestType(
      type
    );
    setSelectedDevice(
      null
    );
    setSelectedContact(
      null
    );
    setRequestId(null);
    setRequestError("");
  }

  function chooseStandardRequestType(
    type: StandardRequestType
  ) {
    setStandardRequestType(
      type
    );
    setSelectedContact(
      null
    );
    setRequestId(null);
    setRequestError("");
  }

  if (
    !mounted ||
    !user ||
    loadingPackage ||
    !selectedPackage
  ) {
    return (
      <main
        dir={
          isArabic
            ? "rtl"
            : "ltr"
        }
        className="flex min-h-[70vh] items-center justify-center bg-white dark:bg-[#070b14]"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {isArabic
              ? "جاري تجهيز طلبك..."
              : "Preparing your request..."}
          </p>
        </div>
      </main>
    );
  }

  const serviceName =
    selectedPackage.name;

  const duration =
    selectedPackage.durationLabel;

  return (
    <main
      dir={
        isArabic
          ? "rtl"
          : "ltr"
      }
      className="min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-[#070b14] dark:text-white"
    >
      <section className="relative isolate overflow-hidden border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-48 -top-48 h-[520px] w-[520px] rounded-full bg-blue-500/[0.09] blur-[110px] dark:bg-blue-500/[0.06]" />

          <div className="absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full bg-cyan-400/[0.08] blur-[110px] dark:bg-cyan-400/[0.05]" />

          <div className="absolute right-[10%] top-24 h-48 w-48 rounded-full border border-blue-200/40 dark:border-blue-400/[0.07]" />

          <div className="absolute right-[13%] top-28 h-32 w-32 rounded-full border border-cyan-200/40 dark:border-cyan-400/[0.06]" />

          <div
            className="absolute inset-0 opacity-[0.22] dark:opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(15,23,42,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.025) 1px, transparent 1px)",
              backgroundSize:
                "44px 44px",
              maskImage:
                "linear-gradient(to bottom, black 0%, transparent 78%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, transparent 78%)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs font-black text-slate-600 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:text-blue-400"
            >
              <ChevronLeft
                size={15}
                className={
                  isArabic
                    ? ""
                    : "rotate-180"
                }
              />

              {isArabic
                ? "الرجوع للباقات"
                : "Back to plans"}
            </Link>

            <div
              className={`mt-7 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black ${
                isVip
                  ? "border-blue-200/70 bg-blue-50/70 text-blue-700 dark:border-blue-400/10 dark:bg-blue-500/[0.07] dark:text-blue-400"
                  : "border-blue-200/70 bg-blue-50/70 text-blue-700 dark:border-blue-400/10 dark:bg-blue-500/[0.07] dark:text-blue-400"
              }`}
            >
              {isVip ? (
                <Sparkles
                  size={14}
                />
              ) : (
                <MessageCircle
                  size={14}
                />
              )}

              {isVip
                ? isArabic
                  ? "اشتراك VIP"
                  : "VIP subscription"
                : isArabic
                  ? "إكمال طلب الاشتراك"
                  : "Complete your subscription request"}
            </div>

            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              {isVip
                ? isArabic
                  ? "خلينا نكمل اشتراك VIP."
                  : "Let’s complete your VIP subscription."
                : isArabic
                  ? "راح يكمل اشتراكك قريباً."
                  : "You are one step away."}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-500 sm:text-base dark:text-slate-400">
              {isVip
                ? isArabic
                  ? "اختار نوع العملية أولًا، وبعدها نكمل وياك الخطوات المناسبة."
                  : "Choose the type of VIP request first, then we’ll continue with the right flow."
                : isArabic
                  ? "اختار أولًا إذا تريد اشتراك جديد أو تجديد اشتراكك الحالي، وبعدها نكمل وياك."
                  : "Choose whether you want a new subscription or a renewal, then we’ll continue with you."}
            </p>

            {requestId && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/70 px-4 py-2 text-[11px] font-black text-emerald-700 dark:border-emerald-500/10 dark:bg-emerald-500/[0.05] dark:text-emerald-400">
                <Check
                  size={14}
                />

                {isArabic
                  ? `تم حفظ طلبك #${requestId}`
                  : `Request #${requestId} saved`}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-50/60 dark:bg-[#0a1020]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
          <div className="euclid-glass euclid-surface h-fit rounded-[30px] p-7">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  isVip
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400"
                    : "bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400"
                }`}
              >
                {isVip ? (
                  <Sparkles
                    size={22}
                  />
                ) : (
                  <Tv size={22} />
                )}
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                  {isArabic
                    ? isVip
                      ? "باقة VIP المختارة"
                      : "الباقة المختارة"
                    : isVip
                      ? "SELECTED VIP PLAN"
                      : "SELECTED PACKAGE"}
                </div>

                <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                  {serviceName}
                </h2>
              </div>
            </div>

            <div className="mt-7 grid gap-3">
              <InfoRow
                icon={
                  <Clock3
                    size={17}
                  />
                }
                label={
                  isArabic
                    ? "المدة"
                    : "Duration"
                }
                value={
                  duration
                }
              />

              <InfoRow
                icon={
                  isVip ? (
                    <Sparkles
                      size={17}
                    />
                  ) : (
                    <Tv size={17} />
                  )
                }
                label={
                  isArabic
                    ? "النوع"
                    : "Type"
                }
                value={
                  isVip
                    ? "VIP"
                    : "IPTV"
                }
              />

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4 dark:border-blue-500/10 dark:bg-blue-500/[0.06]">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-500 dark:text-blue-400">
                  {isArabic
                    ? "السعر"
                    : "PRICE"}
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-950 dark:text-white">
                    {currentPrice.toLocaleString(
                      "en-US"
                    )}
                  </span>

                  <span className="text-xs font-bold text-slate-400">
                    IQD
                  </span>
                </div>

                {isVip &&
                  vipRequestType ===
                    "NEW" &&
                  selectedDevice && (
                    <p className="mt-2 text-[11px] font-bold leading-5 text-blue-700/80 dark:text-blue-300/70">
                      {isArabic
                        ? `الباقة ${selectedPackage.price.toLocaleString("en-US")} + الجهاز ${selectedDevice.price.toLocaleString("en-US")}`
                        : `Plan ${selectedPackage.price.toLocaleString("en-US")} + device ${selectedDevice.price.toLocaleString("en-US")}`}
                    </p>
                  )}
              </div>

              {selectedPackage.description && (
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/50">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {isArabic
                      ? "عن الباقة"
                      : "ABOUT THE PACKAGE"}
                  </div>

                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {
                      selectedPackage.description
                    }
                  </p>
                </div>
              )}

              {isVip &&
                vipRequestType ===
                  "NEW" &&
                selectedDevice && (
                  <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/70 px-4 py-4 dark:border-cyan-500/10 dark:bg-cyan-500/[0.05]">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-400">
                      {isArabic
                        ? "الجهاز المختار"
                        : "SELECTED DEVICE"}
                    </div>

                    <div className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                      {
                        selectedDevice.name
                      }
                    </div>
                  </div>
                )}
            </div>

            <div className="mt-7 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-4 dark:border-emerald-500/10 dark:bg-emerald-500/[0.05]">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />

                <p className="text-xs leading-6 text-emerald-800 dark:text-emerald-300">
                  {isArabic
                    ? "طلبك مرتبط بحسابك، وبعد إتمام الاشتراك نكدر نضيف تفاصيل الاشتراك وتاريخ الانتهاء إلى حسابك."
                    : "Your request is linked to your account. After the subscription is completed, we can add its details and expiry date to your account."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isVip && (
              <div className="euclid-glass rounded-[30px] p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
                    <Sparkles
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {isArabic
                        ? "شنو نوع طلبك؟"
                        : "What would you like to do?"}
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      {isArabic
                        ? "اختار الخيار المناسب حتى نكمل وياك."
                        : "Choose the option that matches your request."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      chooseVipRequestType(
                        "NEW"
                      )
                    }
                    className={`rounded-2xl border p-5 text-start transition-all duration-300 hover:-translate-y-0.5 ${
                      vipRequestType ===
                      "NEW"
                        ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 dark:border-blue-400 dark:bg-blue-500/[0.08]"
                        : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
                        <Sparkles
                          size={20}
                        />
                      </div>

                      {vipRequestType ===
                        "NEW" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check
                            size={14}
                          />
                        </div>
                      )}
                    </div>

                    <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
                      {isArabic
                        ? "اشتراك جديد"
                        : "New subscription"}
                    </h3>

                    <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                      {isArabic
                        ? "تختار جهاز VIP متوافق مع الباقة."
                        : "Choose a compatible VIP device for this plan."}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      chooseVipRequestType(
                        "RENEW"
                      )
                    }
                    className={`rounded-2xl border p-5 text-start transition-all duration-300 hover:-translate-y-0.5 ${
                      vipRequestType ===
                      "RENEW"
                        ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 dark:border-blue-400 dark:bg-blue-500/[0.08]"
                        : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Clock3
                          size={20}
                        />
                      </div>

                      {vipRequestType ===
                        "RENEW" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check
                            size={14}
                          />
                        </div>
                      )}
                    </div>

                    <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
                      {isArabic
                        ? "تجديد اشتراك"
                        : "Renew subscription"}
                    </h3>

                    <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                      {isArabic
                        ? "تجديد اشتراكك الحالي بدون اختيار جهاز."
                        : "Renew your current VIP subscription without choosing a device."}
                    </p>
                  </button>
                </div>
              </div>
            )}

            {!isVip && (
              <div className="euclid-glass rounded-[30px] p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
                    <Clock3
                      size={19}
                    />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {isArabic
                        ? "شنو نوع طلبك؟"
                        : "What would you like to do?"}
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      {isArabic
                        ? "اختار إذا تريد اشتراك جديد أو تجديد اشتراكك الحالي."
                        : "Choose whether you want a new subscription or a renewal."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      chooseStandardRequestType(
                        "NEW"
                      )
                    }
                    className={`rounded-2xl border p-5 text-start transition-all duration-300 hover:-translate-y-0.5 ${
                      standardRequestType ===
                      "NEW"
                        ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 dark:border-blue-400 dark:bg-blue-500/[0.08]"
                        : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
                        <Sparkles
                          size={20}
                        />
                      </div>

                      {standardRequestType ===
                        "NEW" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check
                            size={14}
                          />
                        </div>
                      )}
                    </div>

                    <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
                      {isArabic
                        ? "اشتراك جديد"
                        : "New subscription"}
                    </h3>

                    <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                      {isArabic
                        ? "تقديم طلب اشتراك جديد بهذه الباقة."
                        : "Create a new subscription request for this package."}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      chooseStandardRequestType(
                        "RENEW"
                      )
                    }
                    className={`rounded-2xl border p-5 text-start transition-all duration-300 hover:-translate-y-0.5 ${
                      standardRequestType ===
                      "RENEW"
                        ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 dark:border-blue-400 dark:bg-blue-500/[0.08]"
                        : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Clock3
                          size={20}
                        />
                      </div>

                      {standardRequestType ===
                        "RENEW" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check
                            size={14}
                          />
                        </div>
                      )}
                    </div>

                    <h3 className="mt-4 text-base font-black text-slate-900 dark:text-white">
                      {isArabic
                        ? "تجديد اشتراك"
                        : "Renew subscription"}
                    </h3>

                    <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                      {isArabic
                        ? "تمديد اشتراكك الحالي بدل إنشاء اشتراك جديد."
                        : "Extend your current subscription instead of creating a new one."}
                    </p>
                  </button>
                </div>
              </div>
            )}

            {isVip &&
              vipRequestType ===
                "NEW" && (
                <div className="euclid-glass rounded-[30px] p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/[0.08] dark:text-cyan-400">
                        <Tv
                          size={19}
                        />
                      </div>

                      <div>
                        <h2 className="text-lg font-black text-slate-950 dark:text-white">
                          {isArabic
                            ? "اختار جهازك"
                            : "Choose your device"}
                        </h2>

                        <p className="mt-1 text-xs text-slate-400">
                          {isArabic
                            ? "الأجهزة التالية متوافقة مع باقة VIP المختارة."
                            : "These devices are compatible with your selected VIP plan."}
                        </p>
                      </div>
                    </div>

                    {selectedDevice && (
                      <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 sm:inline-flex dark:border-emerald-500/10 dark:bg-emerald-500/[0.05] dark:text-emerald-400">
                        {isArabic
                          ? "تم الاختيار"
                          : "Selected"}
                      </div>
                    )}
                  </div>

                  {loadingDevices ? (
                    <div className="mt-6 flex min-h-32 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

                        {isArabic
                          ? "جاري تحميل الأجهزة..."
                          : "Loading devices..."}
                      </div>
                    </div>
                  ) : devices.length ===
                    0 ? (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-7 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-300">
                      {isArabic
                        ? "حاليًا ماكو أجهزة مرتبطة بهذه الباقة. جرّب التجديد أو تواصل ويانا."
                        : "There are currently no devices linked to this plan. You can renew instead or contact us."}
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-4">
                      {devices.map(
                        (device) => {
                          const selected =
                            selectedDevice?.id ===
                            device.id;

                          return (
                            <button
                              key={
                                device.id
                              }
                              type="button"
                              onClick={() =>
                                setSelectedDevice(
                                  device
                                )
                              }
                              className={`overflow-hidden rounded-2xl border text-start transition-all duration-300 hover:-translate-y-0.5 ${
                                selected
                                  ? "border-blue-500 bg-blue-50/60 shadow-lg shadow-blue-500/10 dark:border-blue-400 dark:bg-blue-500/[0.07]"
                                  : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500/30"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row">
                                <div className="relative h-44 shrink-0 overflow-hidden bg-slate-100 sm:h-32 sm:w-44 dark:bg-slate-800">
                                  {device.imageUrl ? (
                                    <img
                                      src={
                                        device.imageUrl
                                      }
                                      alt={
                                        device.name
                                      }
                                      className="h-full w-full object-cover transition duration-500 hover:scale-105"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-blue-300 dark:from-blue-950/20 dark:via-slate-900 dark:to-cyan-950/20 dark:text-blue-500">
                                      <Tv
                                        size={
                                          34
                                        }
                                      />
                                    </div>
                                  )}

                                  {selected && (
                                    <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg">
                                      <Check
                                        size={
                                          16
                                        }
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col justify-between p-5">
                                  <div>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                                        {
                                          device.name
                                        }
                                      </h3>

                                      <span className="shrink-0 text-lg font-black text-blue-700 dark:text-blue-400">
                                        {device.price.toLocaleString(
                                          "en-US"
                                        )}{" "}
                                        <span className="text-[10px] text-slate-400">
                                          IQD
                                        </span>
                                      </span>
                                    </div>

                                    {device.description && (
                                      <p className="line-clamp-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                                        {
                                          device.description
                                        }
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-4 flex items-center justify-between gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                                      VIP
                                    </span>

                                    <span
                                      className={`text-xs font-black ${
                                        selected
                                          ? "text-blue-700 dark:text-blue-400"
                                          : "text-slate-500 dark:text-slate-300"
                                      }`}
                                    >
                                      {selected
                                        ? isArabic
                                          ? "هذا الجهاز محدد"
                                          : "Device selected"
                                        : isArabic
                                          ? "اختيار الجهاز"
                                          : "Select device"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

            <div className="euclid-glass rounded-[30px] p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
                  <UserRound
                    size={19}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {isArabic
                      ? "بيانات المشترك"
                      : "Subscriber details"}
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    {isArabic
                      ? "هذه المعلومات راح تكون ضمن طلبك."
                      : "These details will be included in your request."}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <UserInfo
                  icon={
                    <UserRound
                      size={16}
                    />
                  }
                  label={
                    isArabic
                      ? "الاسم"
                      : "Name"
                  }
                  value={
                    user.name
                  }
                />

                <UserInfo
                  icon={
                    <Phone size={16} />
                  }
                  label={
                    isArabic
                      ? "رقم الهاتف"
                      : "Phone"
                  }
                  value={
                    user.phone
                  }
                />
              </div>
            </div>

            {(!isVip ||
              vipRequestType !==
                null) && (
              <>
                <div
                  className={`euclid-surface relative overflow-hidden rounded-[30px] border bg-white p-7 shadow-sm dark:bg-slate-900 ${
                    canContact
                      ? "border-sky-200/70 dark:border-sky-500/10"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-sky-400/[0.08] blur-3xl" />

                  <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/[0.09] dark:text-sky-400">
                        <Send
                          size={21}
                        />
                      </div>

                      <div>
                        <h2 className="text-lg font-black text-slate-950 dark:text-white">
                          Telegram
                        </h2>

                        <p className="mt-1 text-xs text-slate-400">
                          {isArabic
                            ? "الأسرع لإرسال الطلب"
                            : "Fastest way to send your request"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void openTelegram();
                      }}
                      disabled={
                        savingRequest ||
                        !canContact
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition-all duration-300 hover:-translate-y-1 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isArabic
                        ? "التوجه إلى Telegram"
                        : "Open Telegram"}

                      <Send
                        size={17}
                      />
                    </button>
                  </div>

                  <div className="relative mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-xs leading-6 text-slate-500 dark:text-slate-300">
                      {!canContact &&
                      isVip &&
                      vipRequestType ===
                        "NEW"
                        ? isArabic
                          ? "اختار جهاز VIP أولًا حتى نكدر نجهز طلبك."
                          : "Choose a VIP device first so we can prepare your request."
                        : !canContact &&
                            !isVip
                          ? isArabic
                            ? "اختار أولًا «اشتراك جديد» أو «تجديد اشتراك»."
                            : "Choose “New subscription” or “Renew subscription” first."
                          : isVip &&
                              vipRequestType ===
                                "RENEW"
                            ? isArabic
                              ? "التجديد ما يحتاج اختيار جهاز."
                              : "Renewal does not require device selection."
                            : isArabic
                              ? "راح تنفتح المحادثة والرسالة تكون مجهزة تلقائيًا."
                              : "The conversation will open with your message prepared automatically."}
                    </p>
                  </div>
                </div>

                <div
                  className={`euclid-surface relative overflow-hidden rounded-[30px] border bg-white p-7 shadow-sm dark:bg-slate-900 ${
                    canContact
                      ? "border-blue-200/70 dark:border-blue-500/10"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="pointer-events-none absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-blue-500/[0.08] blur-3xl" />

                  <div className="relative">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.09] dark:text-blue-400">
                        <MessageCircle
                          size={21}
                        />
                      </div>

                      <div>
                        <h2 className="text-lg font-black text-slate-950 dark:text-white">
                          Facebook
                        </h2>

                        <p className="mt-1 text-xs text-slate-400">
                          {isArabic
                            ? "انسخ الرسالة ثم افتح Messenger"
                            : "Copy the message, then open Messenger"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                          {isArabic
                            ? "الرسالة الجاهزة"
                            : "READY MESSAGE"}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            void copyMessage();
                          }}
                          disabled={
                            !message
                          }
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                            copied
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-white text-slate-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                          }`}
                        >
                          {copied ? (
                            <>
                              <Check
                                size={15}
                              />

                              {isArabic
                                ? "تم النسخ"
                                : "Copied"}
                            </>
                          ) : (
                            <>
                              <Copy
                                size={15}
                              />

                              {isArabic
                                ? "نسخ"
                                : "Copy"}
                            </>
                          )}
                        </button>
                      </div>

                      <div className="rounded-xl bg-white p-4 text-sm leading-7 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                        {message
                          .split(
                            "\n"
                          )
                          .map(
                            (
                              line,
                              index
                            ) => (
                              <span
                                key={`${line}-${index}`}
                                className="block min-h-[1.5rem]"
                              >
                                {
                                  line
                                }
                              </span>
                            )
                          )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void copyMessage();

                        window.setTimeout(
                          () => {
                            void openFacebook();
                          },
                          150
                        );
                      }}
                      disabled={
                        savingRequest ||
                        !canContact
                      }
                      className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageCircle
                        size={18}
                      />

                      {isArabic
                        ? "نسخ الرسالة والتوجه إلى Messenger"
                        : "Copy message & open Messenger"}

                      <ArrowLeft
                        size={17}
                        className={
                          isArabic
                            ? ""
                            : "rotate-180"
                        }
                      />
                    </button>
                  </div>
                </div>
              </>
            )}

            {isVip &&
              !vipRequestType && (
                <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 px-5 py-4 text-xs font-bold leading-6 text-blue-700 dark:border-blue-500/10 dark:bg-blue-500/[0.06] dark:text-blue-400">
                  {isArabic
                    ? "اختار «اشتراك جديد» أو «تجديد اشتراك» حتى تظهر لك الخطوة التالية."
                    : "Choose “New subscription” or “Renew subscription” to continue."}
                </div>
              )}

            {!isVip &&
              !standardRequestType && (
                <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 px-5 py-4 text-xs font-bold leading-6 text-blue-700 dark:border-blue-500/10 dark:bg-blue-500/[0.06] dark:text-blue-400">
                  {isArabic
                    ? "اختار «اشتراك جديد» أو «تجديد اشتراك» حتى تظهر لك الخطوة التالية."
                    : "Choose “New subscription” or “Renew subscription” to continue."}
                </div>
              )}

            {requestError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-300">
                <div className="flex items-start gap-3">
                  <CircleAlert
                    size={17}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    {requestError}
                  </span>
                </div>
              </div>
            )}

            {selectedContact && (
              <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 px-5 py-4 text-xs font-bold text-blue-700 dark:border-blue-500/10 dark:bg-blue-500/[0.06] dark:text-blue-400">
                {isArabic
                  ? selectedContact ===
                    "TELEGRAM"
                    ? "تم تسجيل أن طريقة التواصل المختارة هي Telegram."
                    : "تم تسجيل أن طريقة التواصل المختارة هي Facebook."
                  : selectedContact ===
                    "TELEGRAM"
                  ? "Telegram has been saved as your contact method."
                  : "Facebook has been saved as your contact method."}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[70vh] items-center justify-center bg-white dark:bg-[#070b14]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              جاري تجهيز طلبك...
            </p>
          </div>
        </main>
      }
    >
      <ContactPageContent />
    </Suspense>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-900/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-400">
          {label}
        </div>

        <div className="mt-0.5 truncate text-sm font-black text-slate-800 dark:text-slate-200">
          {value}
        </div>
      </div>
    </div>
  );
}

function UserInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}

        <span className="text-[10px] font-bold">
          {label}
        </span>
      </div>

      <div className="mt-2 truncate text-sm font-black text-slate-800 dark:text-slate-200">
        {value}
      </div>
    </div>
  );
}