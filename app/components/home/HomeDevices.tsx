import { ArrowLeft, Check, Cpu } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/app/ui/Button";
import { distinctLines } from "@/app/ui/catalogue-text";
import { cn } from "@/app/ui/cn";
import { Container } from "@/app/ui/Page";
import { formatPrice, translator, type Lang } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";
import type { CatalogDevice, CatalogPackage } from "@/src/server/catalog";

/**
 * VIP on the homepage, as its own chapter (warm black with champagne, like
 * the VIP chapter on /plans): the live VIP plans by name, duration and price,
 * and the active devices from the catalogue (Admin → Devices) with their
 * real price and the existing device purchase links. Specifications come
 * only from the device record. Hidden when no device is published.
 *
 * The cards are the homepage's own; the shared DeviceCard stays as it is for
 * /devices and the admin preview.
 */
export function HomeDevices({ lang, devices, packages }: { lang: Lang; devices: CatalogDevice[]; packages: CatalogPackage[] }) {
  const t = translator(lang);

  if (!devices.length) {
    return null;
  }

  const vip = packages.filter((pkg) => pkg.serviceType === "VIP");
  const shown = devices.slice(0, 3);
  const withPanel = shown.length < 3 && vip.length > 0;
  const deviceFrom = Math.min(...devices.map((device) => device.price));

  return (
    <section className="bg-vip-field py-12 sm:py-24" aria-labelledby="home-vip-heading" data-testid="home-vip">
      <Container>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="max-w-2xl">
            <h2 id="home-vip-heading" className="text-balance text-h2 font-bold text-vip">
              {t("أجهزة VIP جاهزة للمشاهدة", "VIP devices, ready to watch")}
            </h2>
            <p className="mt-2 text-pretty text-base leading-8 text-vip-text sm:mt-3">
              {t(
                "جهاز مخصص مرتبط باشتراك VIP. اطلبه مع باقة أو لوحده.",
                "A dedicated device linked to a VIP plan. Order it with a plan or on its own.",
              )}{" "}
              <span className="nums font-bold text-vip" data-testid="home-vip-device-from">
                {t(`الأجهزة تبدأ من ${formatPrice(deviceFrom, lang)}.`, `Devices from ${formatPrice(deviceFrom, lang)}.`)}
              </span>
            </p>
          </div>
          <Link href="/devices" className="inline-flex h-11 shrink-0 items-center gap-2 text-sm font-bold text-vip transition-colors hover:text-white">
            {t("كل الأجهزة", "All devices")}
            <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
          </Link>
        </div>

        <div className={cn("mt-6 grid gap-3 md:mt-10 md:gap-5", withPanel && shown.length === 1 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
          {withPanel ? (
            <aside className="flex flex-col rounded-panel border border-vip-line bg-vip-soft p-5 sm:p-8" data-testid="home-vip-plans">
              <h3 className="text-xl font-bold text-vip">{t("باقات VIP", "VIP plans")}</h3>
              <ul className="mt-3 space-y-2 text-sm text-vip-text sm:mt-4 sm:space-y-2.5">
                {[
                  t("جهاز VIP ضمن الطلب", "VIP device included in the order"),
                  t("الدخول مرتبط برقم الجهاز", "Sign-in linked to the device ID"),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-vip" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <dl className="mt-4 divide-y divide-vip-line border-y border-vip-line sm:mt-6">
                {vip.slice(0, 3).map((pkg) => (
                  <div key={pkg.id} className="flex items-center justify-between gap-4 py-2.5 sm:py-3" data-testid="home-vip-plan-row">
                    <dt className="min-w-0">
                      <bdi className="block truncate font-bold text-vip">{pkg.name}</bdi>
                      <span className="nums text-xs text-vip-text">{formatDuration(pkg.durationMonths, lang)}</span>
                    </dt>
                    <dd className="nums shrink-0 font-bold text-vip">{formatPrice(pkg.price, lang)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto pt-4 sm:pt-6">
                <Link href="/plans#vip" className={buttonClass("vip", "md", "w-full")}>
                  {t("شوف باقات VIP", "See VIP plans")}
                </Link>
              </div>
            </aside>
          ) : null}
          {shown.map((device) => (
            <HomeDeviceCard key={device.id} device={device} plans={packages} lang={lang} />
          ))}
        </div>
      </Container>
    </section>
  );
}

/** One VIP device on the homepage: name, what it is, its facts, the plans it works with, its price, and the purchase links. */
function HomeDeviceCard({ device, plans, lang }: { device: CatalogDevice; plans: CatalogPackage[]; lang: Lang }) {
  const t = translator(lang);
  const compatible = plans.filter((plan) => device.packageIds.includes(plan.id));
  const firstPlan = compatible[0];
  // Description and facts that only repeat the name, or each other, go.
  const kept = distinctLines([device.description || null, ...device.features], device.name);
  const hasDescription = Boolean(device.description) && kept[0] === device.description.trim();
  const shownFacts = (hasDescription ? kept.slice(1) : kept).slice(0, 4);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-panel border border-vip-line bg-vip-soft" data-testid="home-device-card">
      {device.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={device.imageUrl} alt={device.name} loading="lazy" decoding="async" className="aspect-[16/10] w-full bg-vip-field object-contain p-6" />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-5 md:gap-4 md:p-6">
        <div className="flex items-start gap-3">
          {device.imageUrl ? null : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-vip-line text-vip" aria-hidden>
              <Cpu size={20} />
            </span>
          )}
          <div className="min-w-0">
            <h3 dir="auto" className="text-xl font-bold leading-8 text-vip" data-testid="home-device-name">
              {device.name}
            </h3>
            {hasDescription ? (
              <p dir="auto" className="mt-1 line-clamp-2 text-sm leading-6 text-vip-text">
                {device.description}
              </p>
            ) : null}
          </div>
        </div>

        {shownFacts.length ? (
          <ul className="flex flex-wrap gap-2">
            {shownFacts.map((fact) => (
              <li key={fact} dir="auto" className="rounded-lg border border-vip-line px-2.5 py-1 text-sm text-vip-text">
                {fact}
              </li>
            ))}
          </ul>
        ) : null}

        {compatible.length ? (
          <p className="text-sm text-vip-text">
            {t("يشتغل مع: ", "Works with: ")}
            {compatible.map((plan, index) => (
              <span key={plan.id}>
                {index ? t("، ", ", ") : null}
                <bdi className="font-semibold text-vip">{plan.name}</bdi>
              </span>
            ))}
          </p>
        ) : null}

        <div className="mt-auto border-t border-vip-line pt-3 md:pt-4">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="nums text-[28px] font-black leading-none text-vip" data-testid="home-device-price">
              {new Intl.NumberFormat("en-US").format(device.price)}
            </span>
            <span className="text-sm font-semibold text-vip-text">{t("د.ع", "IQD")}</span>
            {/* Phones: the label sits on the price line; wider screens keep it below. */}
            <span className="ms-1 text-sm text-vip-text md:hidden">· {t("سعر الجهاز", "Device price")}</span>
          </p>
          <p className="mt-1 hidden text-sm text-vip-text md:block">{t("سعر الجهاز", "Device price")}</p>
        </div>
        <div className="grid gap-1 md:gap-2">
          {firstPlan ? (
            <Link
              href={`/checkout?plan=${encodeURIComponent(firstPlan.slug)}&device=${device.id}`}
              className={buttonClass("vip", "md", "w-full md:h-13 md:px-7 md:text-base")}
            >
              {t("اطلبه مع باقة VIP", "Order with a VIP plan")}
              <ArrowLeft size={17} className="ltr:rotate-180" aria-hidden />
            </Link>
          ) : null}
          <Link
            href={`/checkout?device=${device.id}`}
            className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-vip-text transition-colors hover:bg-vip-field hover:text-vip md:h-11"
          >
            {t("شراء الجهاز فقط", "Buy the device only")}
          </Link>
        </div>
      </div>
    </article>
  );
}
