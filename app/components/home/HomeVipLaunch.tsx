"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock3, KeyRound, Link2, RefreshCw } from "lucide-react";

import { formatPrice, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";

import s from "./home.module.css";

export type VipPlan = { id: number; name: string; slug: string; price: number; renewalPrice: number | null; durationMonths: number };
export type VipDevice = { id: number; name: string; price: number; packageIds: number[]; imageUrl: string | null };

/**
 * VIP as a product launch: the device large in the middle, the facts beside
 * it, and a picker whose total is the amount the customer will transfer
 * (plan + device, the same sum the server charges for a new VIP order).
 */
export function HomeVipLaunch({ lang, plans, devices, vipArt }: { lang: Lang; plans: VipPlan[]; devices: VipDevice[]; vipArt: string }) {
  const isAr = lang === "ar";
  const [planId, setPlanId] = useState(plans[0]?.id);
  const plan = plans.find((item) => item.id === planId) ?? plans[0];
  const compatible = plan ? devices.filter((device) => device.packageIds.includes(plan.id)) : [];
  const [deviceId, setDeviceId] = useState(compatible[0]?.id);
  const device = compatible.find((item) => item.id === deviceId) ?? compatible[0];
  const [bump, setBump] = useState(0);

  if (!plan || !device) {
    return null;
  }

  const total = plan.price + device.price;
  const renewal = plan.renewalPrice ?? plan.price;
  const choose = (apply: () => void) => {
    apply();
    setBump((value) => value + 1);
  };

  return (
    <section className={s.wrap} id="vip" aria-labelledby="home-vip-title" data-testid="home-vip">
      <div className={s.vip}>
        <div className={s.vipIn}>
          <div>
            <p className={`${s.kicker} ${s.vipKicker}`}>VIP</p>
            <h2 id="home-vip-title" className={s.h2}>
              {isAr ? "جهاز VIP" : "A VIP device,"}
              <br />
              <span className={s.gold}>{isAr ? "جاهز من أول يوم" : "ready from day one"}</span>
            </h2>
            <p className={s.lead} style={{ marginTop: 16 }}>
              {isAr ? "اختار الجهاز وشوف المبلغ اللي تحوّله بالضبط." : "Choose the device and see exactly what you will transfer."}
            </p>

            {plans.length > 1 ? (
              <div className={s.devPick} role="group" aria-label={isAr ? "الباقة" : "Plan"}>
                {plans.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={s.devOption}
                    aria-pressed={item.id === plan.id}
                    onClick={() => choose(() => setPlanId(item.id))}
                  >
                    <bdi>{item.name}</bdi>
                  </button>
                ))}
              </div>
            ) : null}
            <div className={s.devPick} role="group" aria-label={isAr ? "الجهاز" : "Device"}>
              {compatible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={s.devOption}
                  aria-pressed={item.id === device.id}
                  onClick={() => choose(() => setDeviceId(item.id))}
                >
                  <bdi>{item.name}</bdi>
                </button>
              ))}
            </div>

            <div className={s.total} aria-live="polite">
              <span>
                <small>
                  <bdi>{plan.name}</bdi> + <bdi>{device.name}</bdi>
                </small>
                <b key={bump} className={`nums ${bump ? s.pop : ""}`} data-testid="home-vip-total">
                  {formatPrice(total, lang)}
                </b>
              </span>
              <Link href={`/checkout?plan=${encodeURIComponent(plan.slug)}&device=${device.id}`} className={`${s.btn} ${s.btnGold}`}>
                {isAr ? "اطلب الآن" : "Order now"}
              </Link>
            </div>
          </div>

          <div className={s.vipProduct}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={device.imageUrl ?? vipArt} alt={device.name} width={900} height={900} loading="lazy" />
          </div>

          <div className={s.specs}>
            <div className={s.spec}>
              <span className={s.specIcon} aria-hidden>
                <Clock3 size={22} />
              </span>
              <span>
                <small>{isAr ? "مدة الباقة" : "Plan length"}</small>
                <b>{formatDuration(plan.durationMonths, lang)}</b>
              </span>
            </div>
            <div className={s.spec}>
              <span className={s.specIcon} aria-hidden>
                <Link2 size={22} />
              </span>
              <span>
                <small>{isAr ? "الجهاز" : "The device"}</small>
                <b>{isAr ? "يرتبط باشتراكك" : "Linked to your subscription"}</b>
              </span>
            </div>
            <div className={s.spec}>
              <span className={s.specIcon} aria-hidden>
                <RefreshCw size={22} />
              </span>
              <span>
                <small>{isAr ? "التجديد" : "Renewal"}</small>
                <b className="nums">{isAr ? `${formatPrice(renewal, lang)} بدون جهاز` : `${formatPrice(renewal, lang)}, no device`}</b>
              </span>
            </div>
            <div className={s.spec}>
              <span className={s.specIcon} aria-hidden>
                <KeyRound size={22} />
              </span>
              <span>
                <small>{isAr ? "الدخول" : "Sign-in"}</small>
                <b>{isAr ? "مرتبط برقم الجهاز" : "Linked to the device ID"}</b>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
