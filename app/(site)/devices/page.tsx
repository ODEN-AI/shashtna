import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import d from "@/app/components/devices/devices.module.css";
import { VipDeviceCard } from "@/app/components/devices/VipDeviceCard";
import s from "@/app/components/home/home.module.css";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { EmptyState, ErrorState } from "@/app/ui/States";
import { formatPrice } from "@/src/lib/i18n";
import {
  getActiveDevices,
  getActivePackages,
  type CatalogDevice,
  type CatalogPackage,
} from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "أجهزة VIP",
  description: "أجهزة VIP من شاشتنا: المواصفات والأسعار والباقات المتوافقة.",
  alternates: { canonical: "/devices" },
};

// The VIP picture when a device has none of its own.
const VIP_ART = "/brand/vip-art.jpg";

/**
 * VIP devices in the site's navy direction, with the VIP chapter's gold:
 * a head with the lowest device price and Shashtna's VIP art, then one
 * product card per device. Every name, price and plan comes from the catalogue.
 */
export default async function DevicesPage() {
  const { t, lang } = await getI18n();

  let data: { devices: CatalogDevice[]; plans: CatalogPackage[] } | null = null;

  try {
    const [devices, plans] = await Promise.all([getActiveDevices(), getActivePackages()]);
    data = { devices, plans };
  } catch (error) {
    console.error("DEVICES_PAGE_ERROR:", error);
  }

  const devices = data?.devices ?? [];
  // Two devices or fewer get wider cards, so no empty column is left on wide screens.
  const narrow = devices.length > 0 && devices.length < 3;
  const deviceFrom = devices.length ? Math.min(...devices.map((device) => device.price)) : null;
  const headArt = devices.find((device) => device.imageUrl)?.imageUrl ?? VIP_ART;

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <div className={s.wrap}>
        <section className={d.head} aria-labelledby="devices-title">
          <div>
            <p className={s.kicker} style={{ color: "var(--gold)" }}>
              {t("لباقات VIP", "For VIP plans")}
            </p>
            <h1 id="devices-title" className={d.title}>
              {t("أجهزة VIP", "VIP devices")}
            </h1>
            <p className={d.lead}>
              {t(
                "أجهزة مخصصة لباقات VIP. اطلب الجهاز ويا باقة VIP متوافقة، أو اشتريه لوحده.",
                "Dedicated devices for VIP plans. Order one with a compatible VIP plan, or buy it on its own.",
              )}
            </p>
            <div className={d.headActions}>
              {deviceFrom !== null ? (
                <span className={`${d.from} nums`} data-testid="devices-from">
                  {t(`الأجهزة تبدأ من ${formatPrice(deviceFrom, lang)}.`, `Devices from ${formatPrice(deviceFrom, lang)}.`)}
                </span>
              ) : null}
              <Link href="/plans#vip" className={`${d.btn} ${d.btnGhost}`}>
                {t("باقات VIP", "VIP plans")}
                <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
              </Link>
            </div>
          </div>
          <div className={d.headArt}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={headArt} alt="" />
          </div>
        </section>

        {data === null ? (
          <div className={s.section}>
            <ErrorState
              title={t("تعذر تحميل الأجهزة", "Devices couldn't be loaded")}
              action={<LinkButton href="/devices" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
            />
          </div>
        ) : data.devices.length === 0 ? (
          <div className={s.section}>
            <EmptyState
              title={t("ماكو أجهزة متوفرة حاليًا", "No devices available right now")}
              description={t("تكدر تسأل فريقنا عن التوفر.", "Ask our team about availability.")}
              action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
            />
          </div>
        ) : (
          <div className={cn(d.grid, narrow && d.gridNarrow)}>
            {data.devices.map((device) => (
              <VipDeviceCard key={device.id} device={device} plans={data.plans} lang={lang} vipArt={VIP_ART} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
