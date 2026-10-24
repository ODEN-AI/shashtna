import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { VipDeviceCard } from "@/app/components/devices/VipDeviceCard";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Container } from "@/app/ui/Page";
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
  // Two devices or fewer sit in a narrower frame, so no empty column is left on wide screens.
  const narrow = devices.length > 0 && devices.length < 3;
  const deviceFrom = devices.length ? Math.min(...devices.map((device) => device.price)) : null;

  // The whole page is the VIP chapter: warm black with champagne, as on /plans and the homepage.
  return (
    <div className="bg-vip-field">
      <section className="border-b border-vip-line">
        <Container className={cn("py-10 sm:py-16", narrow && "max-w-5xl")}>
          <h1 className="text-balance text-display font-bold text-vip">{t("أجهزة VIP", "VIP devices")}</h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-8 text-vip-text">
            {t(
              "أجهزة مخصصة لباقات VIP. اطلب الجهاز ويا باقة VIP متوافقة، أو اشتريه لوحده.",
              "Dedicated devices for VIP plans. Order one with a compatible VIP plan, or buy it on its own.",
            )}{" "}
            {deviceFrom !== null ? (
              <span className="nums font-bold text-vip" data-testid="devices-from">
                {t(`الأجهزة تبدأ من ${formatPrice(deviceFrom, lang)}.`, `Devices from ${formatPrice(deviceFrom, lang)}.`)}
              </span>
            ) : null}
          </p>
          <Link href="/plans#vip" className="mt-2 inline-flex h-11 items-center gap-2 text-sm font-bold text-vip transition-colors hover:text-white">
            {t("باقات VIP", "VIP plans")}
            <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
          </Link>
        </Container>
      </section>

      <Container className={cn("py-10 sm:py-14", narrow && "max-w-5xl")}>
        {data === null ? (
          <ErrorState
            title={t("تعذر تحميل الأجهزة", "Devices couldn't be loaded")}
            action={<LinkButton href="/devices" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
          />
        ) : data.devices.length === 0 ? (
          <EmptyState
            title={t("ماكو أجهزة متوفرة حاليًا", "No devices available right now")}
            description={t("تكدر تسأل فريقنا عن التوفر.", "Ask our team about availability.")}
            action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
          />
        ) : (
          <div className={cn("grid gap-4 md:grid-cols-2 md:gap-5", !narrow && "lg:grid-cols-3")}>
            {data.devices.map((device) => (
              <VipDeviceCard key={device.id} device={device} plans={data.plans} lang={lang} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
