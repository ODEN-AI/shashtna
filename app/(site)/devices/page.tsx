import type { Metadata } from "next";

import { LinkButton } from "@/app/ui/Button";
import { DeviceCard } from "@/app/ui/DeviceCard";
import { Container, Eyebrow } from "@/app/ui/Page";
import { EmptyState, ErrorState } from "@/app/ui/States";
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

  return (
    <>
      <section className="bg-cinema border-b border-line">
        <Container className="py-14 sm:py-20">
          <Eyebrow>{t("شاهد على", "Watch on")}</Eyebrow>
          <h1 className="mt-4 text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
            {t("أجهزة VIP", "VIP devices")}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-8 text-ink-2">
            {t(
              "أجهزة مخصصة لباقات VIP. اطلب الجهاز ويا باقة VIP متوافقة، أو اشتريه لوحده.",
              "Dedicated devices for VIP plans. Order one with a compatible VIP plan, or buy it on its own.",
            )}
          </p>
        </Container>
      </section>

      <Container className="py-14">
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.devices.map((device) => (
              <DeviceCard key={device.id} device={device} plans={data.plans} lang={lang} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
