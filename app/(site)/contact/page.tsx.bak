"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Copy,
  MessageCircle,
  Send,
  ShieldCheck,
  UserRound,
  Mail,
  Phone,
  Tv,
  Clock3,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLanguage } from "../components/LanguageProvider";

type UserData = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
};

const services = {
  family: {
    nameAr: "Family",
    nameEn: "Family",
    price: 25000,
  },
  star10: {
    nameAr: "Star10",
    nameEn: "Star10",
    price: 20000,
  },
  max: {
    nameAr: "Max",
    nameEn: "Max",
    price: 25000,
  },
} as const;

const DURATION_AR = "Ø³Ù†Ø© ÙˆØ§Ø­Ø¯Ø©";
const DURATION_EN = "1 Year";

const TELEGRAM_URL =
  "https://t.me/shashtna";

const FACEBOOK_MESSENGER_URL =
  "https://www.facebook.com/profile.php?id=61594341596034";

type ContactMethod =
  | "TELEGRAM"
  | "FACEBOOK";

function ContactPageContent() {
  const { language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const planSlug = searchParams.get("plan");

  const [user, setUser] =
    useState<UserData | null>(null);

  const [mounted, setMounted] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [requestId, setRequestId] =
    useState<number | null>(null);

  const [savingRequest, setSavingRequest] =
    useState(true);

  const [selectedContact, setSelectedContact] =
    useState<ContactMethod | null>(null);

  const [requestError, setRequestError] =
    useState("");

  const isArabic = language === "ar";

  const service = useMemo(() => {
    if (!planSlug) {
      return null;
    }

    return (
      services[
        planSlug as keyof typeof services
      ] ?? null
    );
  }, [planSlug]);

  const message = useMemo(() => {
    if (!user || !service) {
      return "";
    }

    const serviceName = isArabic
      ? service.nameAr
      : service.nameEn;

    const duration = isArabic
      ? DURATION_AR
      : DURATION_EN;

    return isArabic
      ? `Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ø£Ø±ÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ø¨Ø®Ø¯Ù…Ø© ${serviceName} Ù„Ù…Ø¯Ø© ${duration} Ø¹Ù† Ø·Ø±ÙŠÙ‚ Ù…ÙˆÙ‚Ø¹ Ø´Ø§Ø´ØªÙ†Ø§.

Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø´ØªØ±Ùƒ:
Ø§Ù„Ø§Ø³Ù…: ${user.name}
Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ: ${user.phone}
Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ: ${user.email}

Ø§Ù„Ø³Ø¹Ø±: ${service.price.toLocaleString(
          "en-US"
        )} Ø¯ÙŠÙ†Ø§Ø±`
      : `Hello, I would like to subscribe to ${serviceName} for ${duration} through the Shashtna website.

Subscriber details:
Name: ${user.name}
Phone: ${user.phone}
Email: ${user.email}

Price: ${service.price.toLocaleString(
          "en-US"
        )} IQD`;
  }, [user, service, isArabic]);

  useEffect(() => {
    setMounted(true);

    try {
      const savedUser =
        localStorage.getItem("user");

      if (!savedUser) {
        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/contact?plan=${planSlug ?? ""}`
          )}`
        );

        return;
      }

      const parsedUser = JSON.parse(
        savedUser
      ) as UserData;

      if (
        !parsedUser ||
        !parsedUser.id ||
        !parsedUser.name ||
        !parsedUser.phone ||
        !parsedUser.email
      ) {
        localStorage.removeItem("user");

        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/contact?plan=${planSlug ?? ""}`
          )}`
        );

        return;
      }

      setUser(parsedUser);
    } catch {
      localStorage.removeItem("user");

      router.replace(
        `/login?redirect=${encodeURIComponent(
          `/contact?plan=${planSlug ?? ""}`
        )}`
      );
    }
  }, [router, planSlug]);

  useEffect(() => {
    if (mounted && !service) {
      router.replace("/plans");
    }
  }, [mounted, service, router]);

  useEffect(() => {
    if (!user || !service || !planSlug) {
      return;
    }

    const currentUser = user;
    const currentPlanSlug = planSlug;

    let cancelled = false;

    async function createRequest() {
      setSavingRequest(true);
      setRequestError("");

      try {
        const response = await fetch(
          "/api/subscription-requests",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              userId: currentUser.id,
              planSlug:
                currentPlanSlug,
              contactMethod: "PENDING",
            }),
          }
        );

        const data = (await response.json()) as {
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
              ? "ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø·Ù„Ø¨Ùƒ Ø­Ø§Ù„ÙŠÙ‹Ø§. ØªÙ‚Ø¯Ø± ØªÙƒÙ…Ù„ Ø§Ù„ØªÙˆØ§ØµÙ„ ÙˆÙŠØ§Ù†Ø§."
              : "We could not save your request right now. You can still contact us."
          );
        }
      } finally {
        if (!cancelled) {
          setSavingRequest(false);
        }
      }
    }

    void createRequest();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    service,
    planSlug,
    isArabic,
  ]);

  async function saveContactMethod(
    method: ContactMethod
  ) {
    if (!user || !planSlug) {
      return;
    }

    setSelectedContact(method);
    setRequestError("");

    try {
      const response = await fetch(
        "/api/subscription-requests",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            planSlug,
            contactMethod: method,
          }),
        }
      );

      const data = (await response.json()) as {
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
        setRequestId(data.requestId);
      }
    } catch (error) {
      console.error(
        "Update subscription request error:",
        error
      );

      setRequestError(
        isArabic
          ? "ØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ« Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„ØªÙˆØ§ØµÙ„."
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

      window.setTimeout(() => {
        setCopied(false);
      }, 2200);
    } catch (error) {
      console.error(
        "Copy message error:",
        error
      );

      setCopied(false);
    }
  }

  async function openTelegram() {
    if (!message) {
      return;
    }

    await saveContactMethod(
      "TELEGRAM"
    );

    const url =
      `${TELEGRAM_URL}?text=` +
      encodeURIComponent(message);

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function openFacebook() {
    await saveContactMethod(
      "FACEBOOK"
    );

    window.open(
      FACEBOOK_MESSENGER_URL,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (
    !mounted ||
    !service ||
    !user
  ) {
    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        className="flex min-h-[70vh] items-center justify-center bg-white dark:bg-[#070b14]"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {isArabic
              ? "Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² Ø·Ù„Ø¨Ùƒ..."
              : "Preparing your request..."}
          </p>
        </div>
      </main>
    );
  }

  const serviceName = isArabic
    ? service.nameAr
    : service.nameEn;

  const duration = isArabic
    ? DURATION_AR
    : DURATION_EN;

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
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
                ? "Ø§Ù„Ø±Ø¬ÙˆØ¹ Ù„Ù„Ø¨Ø§Ù‚Ø§Øª"
                : "Back to plans"}
            </Link>

            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/70 px-4 py-2 text-xs font-black text-blue-700 dark:border-blue-400/10 dark:bg-blue-500/[0.07] dark:text-blue-400">
              <MessageCircle
                size={14}
              />

              {isArabic
                ? "Ø¥ÙƒÙ…Ø§Ù„ Ø·Ù„Ø¨ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ"
                : "Complete your subscription request"}
            </div>

            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              {isArabic
                ? "Ù‚Ø±ÙŠØ¨ÙŠÙ† Ù†ÙƒÙ…Ù‘Ù„ Ø§Ø´ØªØ±Ø§ÙƒÙƒ."
                : "You are one step away."}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-500 sm:text-base dark:text-slate-400">
              {isArabic
                ? "Ø±Ø§Ø¬Ø¹ Ø¨ÙŠØ§Ù†Ø§ØªÙƒØŒ ÙˆØ¨Ø¹Ø¯Ù‡Ø§ Ø§Ø®ØªØ§Ø± Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„ØªÙˆØ§ØµÙ„ Ø§Ù„Ù…Ù†Ø§Ø³Ø¨Ø© Ø­ØªÙ‰ Ù†ÙƒÙ…Ù„ Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ÙˆÙŠØ§Ùƒ."
                : "Review your details, then choose your preferred way to contact us so we can complete your subscription."}
            </p>

            {requestId && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/70 px-4 py-2 text-[11px] font-black text-emerald-700 dark:border-emerald-500/10 dark:bg-emerald-500/[0.05] dark:text-emerald-400">
                <Check size={14} />

                {isArabic
                  ? `ØªÙ… Ø­ÙØ¸ Ø·Ù„Ø¨Ùƒ #${requestId}`
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
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
                <Tv size={22} />
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                  {isArabic
                    ? "Ø§Ù„Ø®Ø¯Ù…Ø© Ø§Ù„Ù…Ø®ØªØ§Ø±Ø©"
                    : "SELECTED SERVICE"}
                </div>

                <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                  {serviceName}
                </h2>
              </div>
            </div>

            <div className="mt-7 grid gap-3">
              <InfoRow
                icon={
                  <Clock3 size={17} />
                }
                label={
                  isArabic
                    ? "Ø§Ù„Ù…Ø¯Ø©"
                    : "Duration"
                }
                value={duration}
              />

              <InfoRow
                icon={<Tv size={17} />}
                label={
                  isArabic
                    ? "Ø§Ù„Ø®Ø¯Ù…Ø©"
                    : "Service"
                }
                value={serviceName}
              />

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4 dark:border-blue-500/10 dark:bg-blue-500/[0.06]">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-500 dark:text-blue-400">
                  {isArabic
                    ? "Ø§Ù„Ø³Ø¹Ø±"
                    : "PRICE"}
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-950 dark:text-white">
                    {service.price.toLocaleString(
                      "en-US"
                    )}
                  </span>

                  <span className="text-xs font-bold text-slate-400">
                    IQD
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-4 dark:border-emerald-500/10 dark:bg-emerald-500/[0.05]">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />

                <p className="text-xs leading-6 text-emerald-800 dark:text-emerald-300">
                  {isArabic
                    ? "Ø·Ù„Ø¨Ùƒ Ù…Ø±ØªØ¨Ø· Ø¨Ø­Ø³Ø§Ø¨ÙƒØŒ ÙˆØ¨Ø¹Ø¯ Ø¥ØªÙ…Ø§Ù… Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ù†ÙƒØ¯Ø± Ù†Ø¶ÙŠÙ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ÙˆØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡ Ø¥Ù„Ù‰ Ø­Ø³Ø§Ø¨Ùƒ."
                    : "Your request is linked to your account. After the subscription is completed, we can add its details and expiry date to your account."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="euclid-glass rounded-[30px] p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-400">
                  <UserRound size={19} />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {isArabic
                      ? "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø´ØªØ±Ùƒ"
                      : "Subscriber details"}
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    {isArabic
                      ? "Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø±Ø§Ø­ ØªÙƒÙˆÙ† Ø¶Ù…Ù† Ø·Ù„Ø¨Ùƒ."
                      : "These details will be included in your request."}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <UserInfo
                  icon={
                    <UserRound size={16} />
                  }
                  label={
                    isArabic
                      ? "Ø§Ù„Ø§Ø³Ù…"
                      : "Name"
                  }
                  value={user.name}
                />

                <UserInfo
                  icon={<Phone size={16} />}
                  label={
                    isArabic
                      ? "Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ"
                      : "Phone"
                  }
                  value={user.phone}
                />

                <UserInfo
                  icon={<Mail size={16} />}
                  label={
                    isArabic
                      ? "Ø§Ù„Ø¨Ø±ÙŠØ¯"
                      : "Email"
                  }
                  value={user.email}
                />
              </div>
            </div>

            <div className="euclid-surface relative overflow-hidden rounded-[30px] border border-sky-200/70 bg-white p-7 shadow-sm dark:border-sky-500/10 dark:bg-slate-900">
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-sky-400/[0.08] blur-3xl" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/[0.09] dark:text-sky-400">
                    <Send size={21} />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      Telegram
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      {isArabic
                        ? "Ø§Ù„Ø£Ø³Ø±Ø¹ Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨"
                        : "Fastest way to send your request"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void openTelegram();
                  }}
                  disabled={savingRequest}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition-all duration-300 hover:-translate-y-1 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isArabic
                    ? "Ø§Ù„ØªÙˆØ¬Ù‡ Ø¥Ù„Ù‰ Telegram"
                    : "Open Telegram"}

                  <Send size={17} />
                </button>
              </div>

              <div className="relative mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-xs leading-6 text-slate-500 dark:text-slate-300">
                  {isArabic
                    ? "Ø±Ø§Ø­ ØªÙ†ÙØªØ­ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© ÙˆØ§Ù„Ø±Ø³Ø§Ù„Ø© ØªÙƒÙˆÙ† Ù…Ø¬Ù‡Ø²Ø© ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§."
                    : "The conversation will open with your message prepared automatically."}
                </p>
              </div>
            </div>

            <div className="euclid-surface relative overflow-hidden rounded-[30px] border border-blue-200/70 bg-white p-7 shadow-sm dark:border-blue-500/10 dark:bg-slate-900">
              <div className="pointer-events-none absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-blue-500/[0.08] blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.09] dark:text-blue-400">
                    <MessageCircle size={21} />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      Facebook
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      {isArabic
                        ? "Ø§Ù†Ø³Ø® Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø«Ù… Ø§ÙØªØ­ Messenger"
                        : "Copy the message, then open Messenger"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {isArabic
                        ? "Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ø¬Ø§Ù‡Ø²Ø©"
                        : "READY MESSAGE"}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void copyMessage();
                      }}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all duration-300 ${
                        copied
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-white text-slate-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check size={15} />

                          {isArabic
                            ? "ØªÙ… Ø§Ù„Ù†Ø³Ø®"
                            : "Copied"}
                        </>
                      ) : (
                        <>
                          <Copy size={15} />

                          {isArabic
                            ? "Ù†Ø³Ø®"
                            : "Copy"}
                        </>
                      )}
                    </button>
                  </div>

                  <div className="rounded-xl bg-white p-4 text-sm leading-7 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                    {message
                      .split("\n")
                      .map(
                        (
                          line,
                          index
                        ) => (
                          <span
                            key={`${line}-${index}`}
                            className="block min-h-[1.5rem]"
                          >
                            {line}
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
                  disabled={savingRequest}
                  className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageCircle
                    size={18}
                  />

                  {isArabic
                    ? "Ù†Ø³Ø® Ø§Ù„Ø±Ø³Ø§Ù„Ø© ÙˆØ§Ù„ØªÙˆØ¬Ù‡ Ø¥Ù„Ù‰ Messenger"
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

            {requestError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs font-bold leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-300">
                {requestError}
              </div>
            )}

            {selectedContact && (
              <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 px-5 py-4 text-xs font-bold text-blue-700 dark:border-blue-500/10 dark:bg-blue-500/[0.06] dark:text-blue-400">
                {isArabic
                  ? selectedContact ===
                    "TELEGRAM"
                    ? "ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø£Ù† Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„ØªÙˆØ§ØµÙ„ Ø§Ù„Ù…Ø®ØªØ§Ø±Ø© Ù‡ÙŠ Telegram."
                    : "ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø£Ù† Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„ØªÙˆØ§ØµÙ„ Ø§Ù„Ù…Ø®ØªØ§Ø±Ø© Ù‡ÙŠ Facebook."
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
              Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² Ø·Ù„Ø¨Ùƒ...
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
