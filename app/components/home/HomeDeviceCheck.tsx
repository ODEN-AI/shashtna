"use client";

import Link from "next/link";
import { useState } from "react";
import { Laptop, MonitorSmartphone, Smartphone, Tablet, Tv } from "lucide-react";

import type { Lang } from "@/src/lib/i18n";

import s from "./home.module.css";

export type CheckPlatform = { platform: string; apps: { name: string; slug: string; instructions: string[] }[] };

const LABELS: Record<string, { ar: string; en: string; hint: { ar: string; en: string }; icon: typeof Tv }> = {
  ANDROID_TV: { ar: "Android TV", en: "Android TV", hint: { ar: "الشاشات الذكية وGoogle TV", en: "Smart TVs and Google TV" }, icon: Tv },
  ANDROID: { ar: "Android", en: "Android", hint: { ar: "الموبايل والتابلت", en: "Phones and tablets" }, icon: Smartphone },
  IOS: { ar: "iPhone و iPad", en: "iPhone and iPad", hint: { ar: "iOS", en: "iOS" }, icon: Tablet },
  WINDOWS: { ar: "Windows", en: "Windows", hint: { ar: "الكمبيوتر", en: "Computers" }, icon: Laptop },
};

/**
 * "Does it work on my device?" before paying. The devices are the platforms
 * in the apps catalogue (Admin → Apps), and the answer names the app for that
 * platform with its own setup steps, so nothing here is invented.
 */
export function HomeDeviceCheck({ lang, platforms }: { lang: Lang; platforms: CheckPlatform[] }) {
  const isAr = lang === "ar";
  const [active, setActive] = useState(0);
  const current = platforms[active];

  if (!current) {
    return null;
  }

  const labelOf = (platform: string) => LABELS[platform.toUpperCase().replace(/[\s-]+/g, "_")];
  const nameOf = (platform: string) => labelOf(platform)?.[lang] ?? platform;
  const app = current.apps[0];
  const steps = app?.instructions.length
    ? app.instructions.slice(0, 3)
    : [
        isAr ? "حمّل التطبيق من صفحة التطبيقات" : "Install the app from the Apps page",
        isAr ? "افتح «اشتراكاتي» بحسابك بعد التفعيل" : "Open Subscriptions in your account after activation",
        isAr ? "سجّل دخولك بالتطبيق وابدأ المشاهدة" : "Sign in to the app and start watching",
      ];

  return (
    <section className={`${s.wrap} ${s.section}`} id="devices" aria-labelledby="home-devices-title">
      <p className={s.kicker}>{isAr ? "الأجهزة المدعومة" : "Supported devices"}</p>
      <h2 id="home-devices-title" className={s.h2}>
        {isAr ? "تأكد إن جهازك يشتغل قبل ما تدفع" : "Check your device before you pay"}
      </h2>
      <div className={s.check}>
        <div className={s.devList} role="group" aria-label={isAr ? "اختار جهازك" : "Choose your device"}>
          {platforms.map((item, index) => {
            const Icon = labelOf(item.platform)?.icon ?? MonitorSmartphone;

            return (
              <button
                key={item.platform}
                type="button"
                className={`${s.card} ${s.dev}`}
                aria-pressed={index === active}
                onClick={() => setActive(index)}
              >
                <span className={s.devIcon} aria-hidden>
                  <Icon size={28} />
                </span>
                <b dir="auto">{nameOf(item.platform)}</b>
                <small>{labelOf(item.platform)?.hint[lang] ?? item.apps.map((entry) => entry.name).join("، ")}</small>
              </button>
            );
          })}
        </div>

        <div className={`${s.card} ${s.answer}`} aria-live="polite">
          <div>
            <span className={s.ok}>{isAr ? "مدعوم" : "Supported"}</span>
            <h3>
              <bdi>{current.apps.map((entry) => entry.name).join(isAr ? " و" : " and ")}</bdi>
              {isAr ? " على " : " on "}
              <bdi>{nameOf(current.platform)}</bdi>
            </h3>
          </div>
          <ol className={s.steps3}>
            {steps.map((step) => (
              <li key={step} dir="auto">
                {step}
              </li>
            ))}
          </ol>
          <div className={s.actions} style={{ marginTop: 0 }}>
            {app ? (
              <Link href={`/apps#app-${app.slug}`} className={`${s.btn} ${s.btnPrimary}`}>
                {isAr ? "حمّل التطبيق" : "Get the app"}
              </Link>
            ) : null}
            <Link href="/watch" className={`${s.btn} ${s.btnGhost}`}>
              {isAr ? "دليل الإعداد" : "Setup guide"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
