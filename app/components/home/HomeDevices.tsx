import { ArrowLeft, Check, Crown } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { DeviceCard } from "@/app/ui/DeviceCard";
import { cn } from "@/app/ui/cn";
import { Container, SectionHeading } from "@/app/ui/Page";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";
import type { CatalogDevice, CatalogPackage } from "@/src/server/catalog";

/**
 * Active devices from the catalogue (Admin → Devices), shown with the same
 * card and the same device purchase links as /devices. Specifications come
 * only from the device record. With one or two devices, a VIP panel built
 * from the live VIP plans fills the row. Hidden when no device is published.
 */
export function HomeDevices({ lang, devices, packages }: { lang: Lang; devices: CatalogDevice[]; packages: CatalogPackage[] }) {
  const t = translator(lang);

  if (!devices.length) {
    return null;
  }

  const vip = packages.filter((pkg) => pkg.serviceType === "VIP");
  const shown = devices.slice(0, 3);
  const withPanel = shown.length < 3 && vip.length > 0;

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow={t("الأجهزة و VIP", "Devices & VIP")}
          title={t("أجهزة VIP جاهزة للمشاهدة", "VIP devices, ready to watch")}
          description={t(
            "جهاز مخصص مرتبط باشتراك VIP. اطلبه مع باقة أو لوحده.",
            "A dedicated device linked to a VIP plan. Order it with a plan or on its own.",
          )}
          action={
            <LinkButton href="/devices" variant="ghost">
              {t("كل الأجهزة", "All devices")}
              <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
            </LinkButton>
          }
        />
        <div
          className={cn(
            "mt-10 grid gap-5",
            withPanel ? (shown.length === 1 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3") : "md:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {withPanel ? (
            <aside className="bg-brand-band edge-light flex flex-col rounded-panel border border-white/10 p-6 shadow-float sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-glow">
                <Crown size={20} aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-bold text-white">{t("باقات VIP", "VIP plans")}</h3>
              <p className="mt-2 text-sm leading-7 text-white/80">
                {t(
                  "تجربة مشاهدة مميزة مع جهاز VIP مخصص مرتبط باشتراكك.",
                  "A premium experience with a dedicated VIP device linked to your subscription.",
                )}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-white/85">
                {[
                  t("جهاز VIP ضمن الطلب", "VIP device included in the order"),
                  t("الدخول مرتبط برقم الجهاز", "Sign-in linked to the device ID"),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-glow" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {vip.slice(0, 3).map((pkg) => (
                  <div key={pkg.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <dt className="text-white/80">{pkg.durationLabel}</dt>
                    <dd className="nums font-bold text-white">{formatPrice(pkg.price, lang)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto pt-6">
                <LinkButton href="/plans#vip" variant="glow" className="w-full">
                  {t("شوف باقات VIP", "See VIP plans")}
                </LinkButton>
              </div>
            </aside>
          ) : null}
          {shown.map((device) => (
            <DeviceCard key={device.id} device={device} plans={packages} lang={lang} />
          ))}
        </div>
      </Container>
    </section>
  );
}
